import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { Run, Step } from '@schemas';
import { executeRun, sweepExpiredRuns, type RunAgent } from './worker-core';

const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT = 'demo-ai';

let app: App;
let db: Firestore;

beforeAll(() => {
  app = initializeApp({ projectId: PROJECT }, 'worker-core-test');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  if (!EMULATOR) return;
  await fetch(`http://${EMULATOR}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, {
    method: 'DELETE',
  });
});

const succeeds: RunAgent = async () => ({ outcome: 'succeeded', summary: 'done' });
const fails: RunAgent = async () => ({ outcome: 'failed', summary: 'boom' });

function seedRun(id: string, overrides: Partial<Run> = {}): Promise<unknown> {
  return db
    .collection('runs')
    .doc(id)
    .set({
      role: 'builder',
      target: { kind: 'step', id: 'step1' },
      inputRefs: [],
      status: 'queued',
      attemptNumber: 1,
      createdAt: 0,
      ...overrides,
    });
}

function seedStep(id: string, overrides: Partial<Step> = {}): Promise<unknown> {
  return db
    .collection('steps')
    .doc(id)
    .set({
      specId: 'spec1',
      featureId: 'feat1',
      title: 'do a thing',
      kind: 'add',
      assignee: 'builder',
      dependsOn: [],
      acceptance: [],
      status: 'building',
      attempts: 0,
      commitShas: [],
      createdAt: 0,
      ...overrides,
    });
}

function queuedRuns() {
  return db.collection('runs').where('status', '==', 'queued').get();
}

describe.skipIf(!EMULATOR)('executeRun against the emulator', () => {
  it('leases a queued run, runs the agent, and queues the next phase', async () => {
    await seedRun('r1', { target: { kind: 'step', id: 's1' } });
    await seedStep('s1', { status: 'building', attempts: 0 });

    expect(await executeRun(db, 'r1', succeeds, 3)).toBe('succeeded');

    const run = (await db.collection('runs').doc('r1').get()).data();
    expect(run?.status).toBe('succeeded');
    expect(run?.summary).toBe('done');
    expect((await db.collection('steps').doc('s1').get()).data()?.status).toBe('testing');

    const queued = await queuedRuns();
    expect(queued.size).toBe(1);
    expect(queued.docs[0]?.data().role).toBe('tester');
  });

  it('skips a run that is no longer queued', async () => {
    await seedRun('r2', { status: 'running' });
    expect(await executeRun(db, 'r2', succeeds, 3)).toBe('skipped');
  });

  it('runs the agent exactly once under concurrent delivery', async () => {
    await seedRun('r3', { target: { kind: 'step', id: 's3' } });
    await seedStep('s3');
    let calls = 0;
    const counting: RunAgent = async () => {
      calls++;
      return { outcome: 'succeeded', summary: '' };
    };

    const outcomes = await Promise.all([
      executeRun(db, 'r3', counting, 3),
      executeRun(db, 'r3', counting, 3),
    ]);

    expect(calls).toBe(1);
    expect(outcomes.filter((o) => o === 'skipped')).toHaveLength(1);
  });

  it('blocks the step when a failure exhausts the attempt ceiling', async () => {
    await seedRun('r4', { target: { kind: 'step', id: 's4' } });
    await seedStep('s4', { status: 'building', attempts: 2 });

    await executeRun(db, 'r4', fails, 3);

    expect((await db.collection('steps').doc('s4').get()).data()?.status).toBe('blocked');
    expect((await queuedRuns()).size).toBe(0);
  });
});

describe.skipIf(!EMULATOR)('sweepExpiredRuns against the emulator', () => {
  it('abandons an expired run and requeues a retryable attempt', async () => {
    await seedRun('r5', {
      status: 'running',
      leasedUntil: 100,
      attemptNumber: 1,
      target: { kind: 'step', id: 's5' },
    });

    expect(await sweepExpiredRuns(db, 1000, 3)).toEqual({ reaped: 1 });

    expect((await db.collection('runs').doc('r5').get()).data()?.status).toBe('abandoned');
    const queued = await queuedRuns();
    expect(queued.size).toBe(1);
    expect(queued.docs[0]?.data().attemptNumber).toBe(2);
  });

  it('blocks the targeted step when attempts are exhausted', async () => {
    await seedRun('r6', {
      status: 'leased',
      leasedUntil: 100,
      attemptNumber: 3,
      target: { kind: 'step', id: 's6' },
    });
    await seedStep('s6', { status: 'building' });

    await sweepExpiredRuns(db, 1000, 3);

    expect((await db.collection('steps').doc('s6').get()).data()?.status).toBe('blocked');
  });

  it('leaves a live lease untouched', async () => {
    await seedRun('r7', { status: 'leased', leasedUntil: 9999 });
    expect(await sweepExpiredRuns(db, 1000, 3)).toEqual({ reaped: 0 });
  });
});
