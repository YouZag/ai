import type { Firestore } from 'firebase-admin/firestore';
import type { Run, RunReport } from '@schemas';
import { RunSchema, StepSchema } from '@schemas';
import { zodConverter } from './converter.js';
import { leaseRun, reapRun, DEFAULT_MAX_ATTEMPTS } from './run-machine.js';
import { planRunCompletion } from './reactor.js';

const runConverter = zodConverter(RunSchema);
const stepConverter = zodConverter(StepSchema);

export type RunAgent = (run: Run) => Promise<RunReport>;

export async function executeRun(
  db: Firestore,
  runId: string,
  agent: RunAgent,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
): Promise<'skipped' | 'succeeded' | 'failed'> {
  const runRef = db.collection('runs').doc(runId).withConverter(runConverter);

  const claimed = await db.runTransaction(async (tx) => {
    const run = (await tx.get(runRef)).data();
    if (!run || run.status !== 'queued') return null;
    const leased = { ...run, ...leaseRun(run, Date.now()) };
    tx.set(runRef, leased);
    return leased;
  });
  if (!claimed) return 'skipped';

  await runRef.set({ ...claimed, status: 'running', startedAt: Date.now() });

  const { outcome, summary } = await agent(claimed);
  const finishedAt = Date.now();
  const target = claimed.target;

  if (target?.kind === 'step') {
    const stepRef = db.collection('steps').doc(target.id).withConverter(stepConverter);
    await db.runTransaction(async (tx) => {
      const step = (await tx.get(stepRef)).data();
      tx.set(runRef, { ...claimed, status: outcome, finishedAt, summary });
      if (step) {
        const completion = planRunCompletion(claimed, step, outcome, maxAttempts, finishedAt);
        tx.set(stepRef, {
          ...step,
          status: completion.step.status,
          attempts: completion.step.attempts,
        });
        if (completion.nextRun) {
          tx.set(db.collection('runs').doc().withConverter(runConverter), completion.nextRun);
        }
      }
    });
  } else {
    await runRef.set({ ...claimed, status: outcome, finishedAt, summary });
  }

  return outcome;
}

export async function sweepExpiredRuns(
  db: Firestore,
  now: number,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
): Promise<{ reaped: number }> {
  const runsCol = db.collection('runs').withConverter(runConverter);
  const [leased, running] = await Promise.all([
    runsCol.where('status', '==', 'leased').where('leasedUntil', '<=', now).get(),
    runsCol.where('status', '==', 'running').where('leasedUntil', '<=', now).get(),
  ]);

  let reaped = 0;
  for (const snap of [...leased.docs, ...running.docs]) {
    const run = snap.data();
    const decision = reapRun(run, now, maxAttempts);
    if (!decision) continue;
    reaped++;

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
  return { reaped };
}
