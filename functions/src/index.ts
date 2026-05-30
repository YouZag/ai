import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineSecret, defineString } from 'firebase-functions/params';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { GoogleAuth } from 'google-auth-library';
import { ErrorDocumentSchema, RunSchema, RunTaskSchema, type Run } from '@schemas';
import {
  runClaude,
  githubMcpServer,
  firestoreMcpServer,
  zodConverter,
  executeRun,
  sweepExpiredRuns,
  dispatchSteps,
  loadAgent,
  parseRunReport,
  REPORT_INSTRUCTIONS,
  type RunAgent,
} from '@shared';
import { initErrorReporting, reportError } from '@shared/errors';
import { enqueueRunTask, createRunTaskClient } from '@shared/tasks';

initializeApp();

const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');
const githubToken = defineSecret('GITHUB_TOKEN');

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

const errorConverter = zodConverter(ErrorDocumentSchema);
const runConverter = zodConverter(RunSchema);

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

function taskPrompt(run: Run): string {
  const target = run.target ? `${run.target.kind} ${run.target.id}` : 'the repository';
  return `Your target is ${target}. Read its details and any related context from Firestore, carry out your role, and finish.\n\n${REPORT_INSTRUCTIONS}`;
}

export const runWorker = onRequest(
  { memory: '2GiB', timeoutSeconds: 3600, concurrency: 1, secrets: [anthropicApiKey, githubToken] },
  async (req, res) => {
    try {
      const { runId } = RunTaskSchema.parse(req.body);
      const accessToken = await auth.getAccessToken();
      if (!accessToken) throw new Error('Failed to obtain a Google access token');

      const agent: RunAgent = async (run) => {
        const definition = await loadAgent(getFirestore(), run.role);
        if (!definition) {
          return { outcome: 'failed', summary: `No active agent definition for role "${run.role}"` };
        }
        try {
          const result = await runClaude({
            prompt: taskPrompt(run),
            systemPrompt: definition.instructions,
            allowedTools: definition.tools,
            model: definition.model,
            maxTurns: definition.maxTurns,
            mcpServers: {
              github: githubMcpServer(githubToken.value()),
              firestore: firestoreMcpServer(accessToken),
            },
          });
          return parseRunReport(result);
        } catch (agentErr) {
          await reportError(agentErr, { fn: 'runWorker', runId });
          return {
            outcome: 'failed',
            summary: agentErr instanceof Error ? agentErr.message : String(agentErr),
          };
        }
      };

      await executeRun(getFirestore(), runId, agent);
      res.status(200).send('ok');
    } catch (err) {
      await reportError(err, { fn: 'runWorker' });
      res.status(500).send('error');
    }
  },
);

export const reapRuns = onSchedule('every 5 minutes', async () => {
  try {
    const { reaped } = await sweepExpiredRuns(getFirestore(), Date.now());
    logger.info('reaped runs', { reaped });
  } catch (err) {
    await reportError(err, { fn: 'reapRuns' });
  }
});

export const dispatchPendingSteps = onSchedule('every 1 minutes', async () => {
  try {
    const { dispatched } = await dispatchSteps(getFirestore(), Date.now());
    logger.info('dispatched steps', { dispatched });
  } catch (err) {
    await reportError(err, { fn: 'dispatchPendingSteps' });
  }
});
