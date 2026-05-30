# Orchestration spine

The build pipeline runs as a self-feeding loop over Firestore. Each unit of agent
work is a `runs` document; a worker executes it and writes the next one.

## The loop

1. A `runs/{id}` document is created with `status: 'queued'`.
2. `onRunCreated` (Firestore trigger) enqueues a Cloud Task that POSTs `{ runId }`
   to the worker.
3. `runWorker` (a Gen2 `onRequest` function — i.e. a Cloud Run service) leases the
   run transactionally, runs the agent, then in one transaction writes the run
   outcome, patches the target step, and creates the next `queued` run — which
   re-triggers step 2. The loop ends when the step reaches `done` or `blocked`.
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

Replace `PROJECT` and `REGION` (e.g. `us-central1`) throughout.

### 1. Secrets

Used by `onErrorCreated` and `runWorker`:

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase functions:secrets:set GITHUB_TOKEN
```

### 2. Cloud Tasks queue

```bash
gcloud tasks queues create build-runs --location=REGION
```

### 3. Function params

`onRunCreated` reads these (non-secret) params. Put them in `functions/.env`:

```
TASKS_LOCATION=REGION
TASKS_QUEUE=build-runs
WORKER_URL=https://REGION-PROJECT.cloudfunctions.net/runWorker
TASKS_INVOKER_SA=tasks-invoker@PROJECT.iam.gserviceaccount.com
```

`WORKER_URL` is the deterministic Gen2 URL for `runWorker`, so it can be set before
the first deploy.

### 4. Service accounts and IAM

Create the invoker identity Cloud Tasks uses to call the worker:

```bash
gcloud iam service-accounts create tasks-invoker
```

Grant it permission to invoke the worker (the Gen2 function is a Cloud Run service
named `runworker`):

```bash
gcloud run services add-iam-policy-binding runworker \
  --region=REGION \
  --member="serviceAccount:tasks-invoker@PROJECT.iam.gserviceaccount.com" \
  --role=roles/run.invoker
```

Let the functions runtime service account enqueue tasks and mint OIDC tokens as the
invoker SA (`FUNCTIONS_SA` is usually `PROJECT@appspot.gserviceaccount.com`):

```bash
gcloud projects add-iam-policy-binding PROJECT \
  --member="serviceAccount:FUNCTIONS_SA" --role=roles/cloudtasks.enqueuer
gcloud iam service-accounts add-iam-policy-binding \
  tasks-invoker@PROJECT.iam.gserviceaccount.com \
  --member="serviceAccount:FUNCTIONS_SA" --role=roles/iam.serviceAccountUser
```

### 5. Deploy

```bash
firebase deploy --only firestore:indexes,functions
```

### 6. Lock down the worker

`runWorker` mutates Firestore, so only the invoker SA should reach it. Remove public
access after the first deploy:

```bash
gcloud run services remove-iam-policy-binding runworker \
  --region=REGION --member=allUsers --role=roles/run.invoker
```

The OIDC token Cloud Tasks attaches is then required. (Optional defense in depth:
verify the token's audience/email inside the handler.)

## Security

`firestore.rules` is default-deny: only the Admin SDK (the functions) writes the
orchestration collections, and browsers cannot read or write them. Open up specific
collections when the cockpit needs client reads.

## Starting a run

Once an agent has produced a spec and steps, kicking the loop is a single write:
create `runs/{id}` with `{ role, target: { kind: 'step', id }, inputRefs: [],
status: 'queued', attemptNumber: 1, createdAt: <now> }`. Everything after that is
automatic.
