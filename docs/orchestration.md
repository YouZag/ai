# Orchestration spine

The build pipeline runs as a self-feeding loop over Firestore. Each unit of agent
work is a `runs` document; a worker executes it and writes the next one.

## The loop

1. A `runs/{id}` document is created with `status: 'queued'`.
2. `onRunCreated` (Firestore trigger) enqueues the run on the worker's task queue
   via the Admin SDK.
3. `runWorker` (a task-queue function) leases the run transactionally, runs the
   agent, then in one transaction writes the run outcome, patches the target step,
   and creates the next `queued` run — which re-triggers step 2. The loop ends when
   the step reaches `done` or `blocked`.
4. `reapRuns` (scheduled every 5 min) sweeps runs whose lease expired and either
   requeues a fresh attempt or blocks the step once attempts are exhausted.

All transition logic lives in `@shared` (`run-machine`, `step-machine`, `reactor`,
`worker-core`) and is pure/unit-tested; the functions in `functions/src/index.ts`
are thin adapters.

## Local development

Run the server-side suite (pure logic + the worker/reaper integration tests)
against the Firestore emulator. Requires Java (the emulator) — no Firebase login is
needed because it uses a `demo-` project.

```bash
npm run test:server
```

The integration tests in `shared/worker-core.test.ts` only run when
`FIRESTORE_EMULATOR_HOST` is set (the `emulators:exec` wrapper sets it); otherwise
they skip, so `vitest --config vitest.server.config.ts` alone still runs the pure
tests.

## Deploying

See [DEPLOY.md](../DEPLOY.md) for the runbook. In short: the worker is a Firebase
task-queue function (`onTaskDispatched`), so Firebase creates and wires its Cloud
Tasks queue on deploy — there is no queue, invoker service account, `run.invoker`, or
worker URL to manage. Set the `ANTHROPIC_API_KEY` and `GITHUB_TOKEN` secrets and the
`REPO_OWNER`/`REPO_NAME`/`WORK_BRANCH` params in `functions/.env`, then
`firebase deploy --only firestore,functions`.

## Worker execution environment

Code-execution runs (builder, designer, tester, auditor) need a working tree. The
worker checks out `WORK_BRANCH` of `REPO_OWNER/REPO_NAME` into `/tmp/workspace`
(reused across warm instances), runs `npm ci` only when the lockfile changes, and
runs the agent with that working directory so it can edit, build, test, and
commit/push through its Bash and git tools. The `GITHUB_TOKEN` secret therefore
needs push access to the repo. The worker runs with 8GiB to fit `npm ci` and builds
in `/tmp`; raise it (Gen2 supports up to 32GiB) if larger builds need more headroom.

## Security

`firestore.rules` is default-deny: only the Admin SDK (the functions) writes the
orchestration collections, and browsers cannot read or write them. Open up specific
collections when the cockpit needs client reads.

## Starting a run

Once an agent has produced a spec and steps, kicking the loop is a single write:
create `runs/{id}` with `{ role, target: { kind: 'step', id }, inputRefs: [],
status: 'queued', attemptNumber: 1, createdAt: <now> }`. Everything after that is
automatic.
