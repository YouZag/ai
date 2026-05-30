import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { becamePlanned, planFeature } from './planner';

describe('becamePlanned', () => {
  it('is true only on the transition into planned', () => {
    expect(becamePlanned('proposed', 'planned')).toBe(true);
    expect(becamePlanned(undefined, 'planned')).toBe(true);
    expect(becamePlanned('planned', 'planned')).toBe(false);
    expect(becamePlanned('planned', 'building')).toBe(false);
    expect(becamePlanned('proposed', 'proposed')).toBe(false);
    expect(becamePlanned('planned', undefined)).toBe(false);
  });
});

const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT = 'demo-ai';

let app: App;
let db: Firestore;

beforeAll(() => {
  app = initializeApp({ projectId: PROJECT }, 'planner-test');
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

describe.skipIf(!EMULATOR)('planFeature against the emulator', () => {
  it('queues a strategist run targeting the feature', async () => {
    const runId = await planFeature(db, 'feat1', 1000);
    const run = (await db.collection('runs').doc(runId).get()).data();
    expect(run?.role).toBe('strategist');
    expect(run?.status).toBe('queued');
    expect(run?.target).toEqual({ kind: 'feature', id: 'feat1' });
    expect(run?.attemptNumber).toBe(1);
  });
});
