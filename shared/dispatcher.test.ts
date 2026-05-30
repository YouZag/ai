import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { Step } from '@schemas';
import { dispatchSteps } from './dispatcher';

const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT = 'demo-ai';

let app: App;
let db: Firestore;

beforeAll(() => {
  app = initializeApp({ projectId: PROJECT }, 'dispatcher-test');
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
  await db.collection('control').doc('pipeline').set({ phase: 'building', updatedAt: 0 });
});

function seedStep(id: string, overrides: Partial<Step> = {}): Promise<unknown> {
  return db
    .collection('steps')
    .doc(id)
    .set({
      specId: 'spec1',
      featureId: 'feat1',
      title: 'step',
      kind: 'add',
      assignee: 'builder',
      dependsOn: [],
      acceptance: [],
      status: 'pending',
      attempts: 0,
      commitShas: [],
      createdAt: 0,
      ...overrides,
    });
}

function queuedRuns() {
  return db.collection('runs').where('status', '==', 'queued').get();
}

describe.skipIf(!EMULATOR)('dispatchSteps against the emulator', () => {
  it('sends a ready agent step to building and queues its first run', async () => {
    await seedStep('s1', { assignee: 'builder' });
    expect(await dispatchSteps(db, 1000)).toEqual({ dispatched: 1 });
    expect((await db.collection('steps').doc('s1').get()).data()?.status).toBe('building');
    const runs = await queuedRuns();
    expect(runs.size).toBe(1);
    expect(runs.docs[0]?.data().role).toBe('builder');
    expect(runs.docs[0]?.data().target.id).toBe('s1');
  });

  it('waits while a dependency is unmet', async () => {
    await seedStep('dep', { status: 'building' });
    await seedStep('s2', { dependsOn: ['dep'] });
    expect(await dispatchSteps(db, 1000)).toEqual({ dispatched: 0 });
    expect((await db.collection('steps').doc('s2').get()).data()?.status).toBe('pending');
  });

  it('dispatches once the dependency is done', async () => {
    await seedStep('dep', { status: 'done' });
    await seedStep('s3', { dependsOn: ['dep'] });
    expect(await dispatchSteps(db, 1000)).toEqual({ dispatched: 1 });
    expect((await db.collection('steps').doc('s3').get()).data()?.status).toBe('building');
  });

  it('routes a human step to awaiting-user with no run', async () => {
    await seedStep('s4', { assignee: 'user', kind: 'task' });
    expect(await dispatchSteps(db, 1000)).toEqual({ dispatched: 1 });
    expect((await db.collection('steps').doc('s4').get()).data()?.status).toBe('awaiting-user');
    expect((await db.collection('runs').get()).size).toBe(0);
  });

  it('does not dispatch the same step twice', async () => {
    await seedStep('s5');
    await dispatchSteps(db, 1000);
    expect(await dispatchSteps(db, 2000)).toEqual({ dispatched: 0 });
    expect((await queuedRuns()).size).toBe(1);
  });

  it('dispatches nothing while the pipeline is in planning', async () => {
    await db.collection('control').doc('pipeline').set({ phase: 'planning', updatedAt: 0 });
    await seedStep('s6', { assignee: 'builder' });
    expect(await dispatchSteps(db, 1000)).toEqual({ dispatched: 0 });
    expect((await db.collection('steps').doc('s6').get()).data()?.status).toBe('pending');
  });
});
