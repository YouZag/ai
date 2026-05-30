import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { applyPlanTool } from './planning';

const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT = 'demo-ai';

let app: App;
let db: Firestore;

beforeAll(() => {
  app = initializeApp({ projectId: PROJECT }, 'planning-test');
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

async function onlyFeature() {
  const snap = await db.collection('features').get();
  expect(snap.size).toBe(1);
  return { id: snap.docs[0].id, data: snap.docs[0].data() };
}

describe.skipIf(!EMULATOR)('applyPlanTool', () => {
  it('writes the vision', async () => {
    await applyPlanTool(db, 'set_vision', {
      statement: 'Turn open time into a real Funday',
      principles: ['joy not screen time'],
      nonGoals: ['no ad feeds'],
    });
    const vision = (await db.collection('vision').doc('current').get()).data();
    expect(vision?.statement).toBe('Turn open time into a real Funday');
    expect(vision?.principles).toEqual(['joy not screen time']);
    expect(vision?.nonGoals).toEqual(['no ad feeds']);
  });

  it('creates a feature as a proposed studio feature', async () => {
    await applyPlanTool(db, 'upsert_feature', {
      title: 'Right Now Generator',
      description: 'Generate a doable Funday from live constraints',
      rationale: 'the wedge',
      acceptance: ['grounded, doable Funday in under 60s'],
      order: 1,
    });
    const { data } = await onlyFeature();
    expect(data.title).toBe('Right Now Generator');
    expect(data.status).toBe('proposed');
    expect(data.createdBy).toBe('studio');
    expect(data.rationale).toBe('the wedge');
    expect(data.order).toBe(1);
  });

  it('updates a feature by id, preserving created metadata', async () => {
    await applyPlanTool(db, 'upsert_feature', { title: 'A', description: 'a' });
    const created = await onlyFeature();
    await applyPlanTool(db, 'upsert_feature', {
      id: created.id,
      title: 'A2',
      description: 'a2',
      acceptance: ['x'],
    });
    const updated = (await db.collection('features').doc(created.id).get()).data();
    expect(updated?.title).toBe('A2');
    expect(updated?.createdAt).toBe(created.data.createdAt);
    expect(updated?.status).toBe('proposed');
    expect(updated?.acceptance).toEqual(['x']);
  });

  it('removes a feature', async () => {
    await applyPlanTool(db, 'upsert_feature', { title: 'Z', description: 'z' });
    const { id } = await onlyFeature();
    await applyPlanTool(db, 'remove_feature', { id });
    expect((await db.collection('features').doc(id).get()).exists).toBe(false);
  });
});
