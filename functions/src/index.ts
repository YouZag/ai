import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineSecret, defineString } from 'firebase-functions/params';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { GoogleAuth } from 'google-auth-library';
import { ErrorDocumentSchema, RunSchema, RunTaskSchema, StepSchema, type Run } from '@schemas';
import {
  runClaude,
  githubMcpServer,
  firestoreMcpServer,
  leaseRun,
  reapRun,
  planRunCompletion,
  DEFAULT_MAX_ATTEMPTS,
} from '@shared';
import { initErrorReporting, reportError } from '@shared/errors';
import { enqueueRunTask, createRunTaskClient } from '@shared/tasks';
import { zodConverter } from './converter.js';

initializeApp();

const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');
const githubToken = defineSecret('GITHUB_TOKEN');

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

const errorConverter = zodConverter(ErrorDocumentSchema);
const runConverter = zodConverter(RunSchema);
const stepConverter = zodConverter(StepSchema);

const runTasksClient = createRunTaskClient();
const tasksLocation = defineString('TASKS_LOCATION');
const tasksQueue = defineString('TASKS_QUEUE');
const workerUrl = defineString('WORKER_URL');
const tasksInvoker = defineString('TASKS_INVOKER_SA');

initErrorReporting({
  source: 'functions',
  write: (doc) => getFirestore().collection('errors').withConverter(errorConverter).add(doc),
});

export const onErrorCreated = onDocumentCreated(
  {
    document: 'errors/{errorId}',
    memory: '2GiB',
    timeoutSeconds: 540,
    secrets: [anthropicApiKey, githubToken],
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const error = errorConverter.fromFirestore(snapshot);
    const errorId = event.params.errorId;

    const [accessToken, projectId] = await Promise.all([auth.getAccessToken(), auth.getProjectId()]);
    if (!accessToken) throw new Error('Failed to obtain a Google access token');

    const summary = await runClaude({
      prompt: `An application error was reported (id: ${errorId}) in Firestore project "${projectId}", database "(default)". Investigate the likely cause, read any related Firestore data that helps, and open a GitHub issue summarizing it with a suggested fix.\n\nMessage: ${error.message}\nStack: ${error.stack ?? '(none)'}`,
      mcpServers: {
        github: githubMcpServer(githubToken.value()),
        firestore: firestoreMcpServer(accessToken),
      },
    });

    logger.info('error triaged', { errorId, summary });
  },
);

export const onRunCreated = onDocumentCreated('runs/{runId}', async (event) => {
  try {
    const snapshot = event.data;
    if (!snapshot) return;

    const run = runConverter.fromFirestore(snapshot);
    if (run.status !== 'queued') return;

    const projectId = await auth.getProjectId();
    const name = await enqueueRunTask(
      runTasksClient,
      {
        projectId,
        location: tasksLocation.value(),
        queue: tasksQueue.value(),
        workerUrl: workerUrl.value(),
        invokerServiceAccount: tasksInvoker.value(),
      },
      { runId: event.params.runId },
    );

    logger.info('run enqueued', { runId: event.params.runId, task: name });
  } catch (err) {
    await reportError(err, { fn: 'onRunCreated', runId: event.params.runId });
  }
});

function workerPrompt(run: Run): string {
  const target = run.target ? `${run.target.kind} ${run.target.id}` : 'the repository';
  return `You are the ${run.role} agent. Your target is ${target}. Carry out your role for this target using the available tools, then summarize what you changed.`;
}

export const runWorker = onRequest(
  { memory: '2GiB', timeoutSeconds: 3600, concurrency: 1, secrets: [anthropicApiKey, githubToken] },
  async (req, res) => {
    try {
      const { runId } = RunTaskSchema.parse(req.body);
      const db = getFirestore();
      const runRef = db.collection('runs').doc(runId).withConverter(runConverter);

      const claimed = await db.runTransaction(async (tx) => {
        const run = (await tx.get(runRef)).data();
        if (!run || run.status !== 'queued') return null;
        const leased = { ...run, ...leaseRun(run, Date.now()) };
        tx.set(runRef, leased);
        return leased;
      });
      if (!claimed) {
        res.status(200).send('skipped');
        return;
      }

      await runRef.set({ ...claimed, status: 'running', startedAt: Date.now() });

      const accessToken = await auth.getAccessToken();
      if (!accessToken) throw new Error('Failed to obtain a Google access token');

      let outcome: 'succeeded' | 'failed';
      let summary: string;
      try {
        summary = await runClaude({
          prompt: workerPrompt(claimed),
          mcpServers: {
            github: githubMcpServer(githubToken.value()),
            firestore: firestoreMcpServer(accessToken),
          },
        });
        outcome = 'succeeded';
      } catch (agentErr) {
        outcome = 'failed';
        summary = agentErr instanceof Error ? agentErr.message : String(agentErr);
        await reportError(agentErr, { fn: 'runWorker', runId });
      }

      const finishedAt = Date.now();
      const target = claimed.target;
      if (target?.kind === 'step') {
        const stepRef = db.collection('steps').doc(target.id).withConverter(stepConverter);
        await db.runTransaction(async (tx) => {
          const step = (await tx.get(stepRef)).data();
          tx.set(runRef, { ...claimed, status: outcome, finishedAt, summary });
          if (step) {
            const completion = planRunCompletion(claimed, step, outcome, DEFAULT_MAX_ATTEMPTS, finishedAt);
            tx.set(stepRef, { ...step, status: completion.step.status, attempts: completion.step.attempts });
            if (completion.nextRun) {
              tx.set(db.collection('runs').doc().withConverter(runConverter), completion.nextRun);
            }
          }
        });
      } else {
        await runRef.set({ ...claimed, status: outcome, finishedAt, summary });
      }

      res.status(200).send('ok');
    } catch (err) {
      await reportError(err, { fn: 'runWorker' });
      res.status(500).send('error');
    }
  },
);

export const reapRuns = onSchedule('every 5 minutes', async () => {
  try {
    const db = getFirestore();
    const now = Date.now();
    const runsCol = db.collection('runs').withConverter(runConverter);
    const [leased, running] = await Promise.all([
      runsCol.where('status', '==', 'leased').where('leasedUntil', '<=', now).get(),
      runsCol.where('status', '==', 'running').where('leasedUntil', '<=', now).get(),
    ]);

    for (const snap of [...leased.docs, ...running.docs]) {
      const run = snap.data();
      const decision = reapRun(run, now, DEFAULT_MAX_ATTEMPTS);
      if (!decision) continue;

      const stepRef =
        !decision.retryable && run.target?.kind === 'step'
          ? db.collection('steps').doc(run.target.id).withConverter(stepConverter)
          : null;

      await db.runTransaction(async (tx) => {
        const step = stepRef ? (await tx.get(stepRef)).data() : undefined;
        tx.set(snap.ref, { ...run, status: 'abandoned', finishedAt: now });
        if (decision.retryable && run.target) {
          tx.set(db.collection('runs').doc().withConverter(runConverter), {
            role: run.role,
            target: run.target,
            inputRefs: run.inputRefs,
            status: 'queued',
            attemptNumber: run.attemptNumber + 1,
            createdAt: now,
          });
        } else if (stepRef && step) {
          tx.set(stepRef, { ...step, status: 'blocked' });
        }
      });
    }

    logger.info('reaped runs', { leased: leased.size, running: running.size });
  } catch (err) {
    await reportError(err, { fn: 'reapRuns' });
  }
});
