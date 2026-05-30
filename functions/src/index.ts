import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getFunctions } from 'firebase-admin/functions';
import { logger } from 'firebase-functions';
import { defineSecret, defineString } from 'firebase-functions/params';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { GoogleAuth } from 'google-auth-library';
import { ErrorDocumentSchema, RunSchema, RunTaskSchema, type Run } from '@schemas';
import {
  runClaude,
  githubMcpServer,
  firestoreMcpServer,
  angularMcpServer,
  zodConverter,
  executeRun,
  sweepExpiredRuns,
  dispatchSteps,
  becamePlanned,
  planFeature,
  loadAgent,
  parseRunReport,
  REPORT_INSTRUCTIONS,
  needsWorkspace,
  prepareWorkspace,
  integrateWork,
  type RunAgent,
} from '@shared';
import { initErrorReporting, reportError } from '@shared/errors';

initializeApp();

const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');
const githubToken = defineSecret('GITHUB_TOKEN');

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

const errorConverter = zodConverter(ErrorDocumentSchema);
const runConverter = zodConverter(RunSchema);

const repoOwner = defineString('REPO_OWNER');
const repoName = defineString('REPO_NAME');
const workBranch = defineString('WORK_BRANCH');

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

    await getFunctions().taskQueue('runWorker').enqueue({ runId: event.params.runId });
    logger.info('run enqueued', { runId: event.params.runId });
  } catch (err) {
    await reportError(err, { fn: 'onRunCreated', runId: event.params.runId });
  }
});

function taskPrompt(run: Run): string {
  const target = run.target ? `${run.target.kind} ${run.target.id}` : 'the repository';
  return `Your target is ${target}. Read its details and any related context from Firestore, carry out your role, and finish.\n\n${REPORT_INSTRUCTIONS}`;
}

export const runWorker = onTaskDispatched(
  {
    memory: '8GiB',
    timeoutSeconds: 1800,
    concurrency: 1,
    retryConfig: { maxAttempts: 3 },
    rateLimits: { maxConcurrentDispatches: 1 },
    secrets: [anthropicApiKey, githubToken],
  },
  async (req) => {
    const { runId } = RunTaskSchema.parse(req.data);
    const accessToken = await auth.getAccessToken();
    if (!accessToken) throw new Error('Failed to obtain a Google access token');

    const agent: RunAgent = async (run) => {
      const definition = await loadAgent(getFirestore(), run.role);
      if (!definition) {
        return { outcome: 'failed', summary: `No active agent definition for role "${run.role}"` };
      }

      let cwd: string | undefined;
      if (needsWorkspace(run.role)) {
        try {
          cwd = await prepareWorkspace({
            owner: repoOwner.value(),
            repo: repoName.value(),
            branch: workBranch.value(),
            token: githubToken.value(),
            dir: '/tmp/workspace',
          });
        } catch (workspaceErr) {
          await reportError(workspaceErr, { fn: 'prepareWorkspace', runId });
          return {
            outcome: 'failed',
            summary: `Workspace setup failed: ${workspaceErr instanceof Error ? workspaceErr.message : String(workspaceErr)}`,
          };
        }
      }

      let priorFailure = '';
      if (run.target?.kind === 'step') {
        const stepSnap = await getFirestore().collection('steps').doc(run.target.id).get();
        const last = stepSnap.get('lastFailure');
        if (typeof last === 'string' && last) {
          priorFailure = `\n\nA previous attempt at this step failed:\n${last}\nDiagnose that specific failure and fix it before finishing; do not repeat it.`;
        }
      }

      const useAngular = run.role === 'builder' || run.role === 'designer';

      try {
        const result = await runClaude({
          prompt: taskPrompt(run) + priorFailure,
          systemPrompt: definition.instructions,
          allowedTools: definition.tools,
          model: definition.model,
          maxTurns: definition.maxTurns,
          cwd,
          mcpServers: {
            github: githubMcpServer(githubToken.value()),
            firestore: firestoreMcpServer(accessToken),
            ...(useAngular ? { angular: angularMcpServer() } : {}),
          },
        });
        const report = parseRunReport(result);
        if (report.outcome === 'succeeded' && cwd && (run.role === 'builder' || run.role === 'designer')) {
          const integration = await integrateWork({
            dir: cwd,
            branch: workBranch.value(),
            message: `${run.role}: ${run.target ? `${run.target.kind} ${run.target.id}` : 'work'}`,
          });
          if (!integration.ok) {
            return { outcome: 'failed', summary: `Integration failed: ${integration.reason}` };
          }
        }
        return report;
      } catch (agentErr) {
        await reportError(agentErr, { fn: 'runWorker', runId });
        return {
          outcome: 'failed',
          summary: agentErr instanceof Error ? agentErr.message : String(agentErr),
        };
      }
    };

    await executeRun(getFirestore(), runId, agent);
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

export const onFeaturePlanned = onDocumentWritten('features/{featureId}', async (event) => {
  try {
    const before = event.data?.before?.data()?.status;
    const after = event.data?.after?.data()?.status;
    if (!becamePlanned(before, after)) return;

    const runId = await planFeature(getFirestore(), event.params.featureId, Date.now());
    logger.info('feature planning queued', { featureId: event.params.featureId, runId });
  } catch (err) {
    await reportError(err, { fn: 'onFeaturePlanned', featureId: event.params.featureId });
  }
});
