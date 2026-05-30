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
      statement: 'A clear product vision',
      principles: ['the first principle'],
      nonGoals: ['the first non-goal'],
    });
    const vision = (await db.collection('vision').doc('current').get()).data();
    expect(vision?.statement).toBe('A clear product vision');
    expect(vision?.principles).toEqual(['the first principle']);
    expect(vision?.nonGoals).toEqual(['the first non-goal']);
  });

  it('creates a feature as a proposed studio feature', async () => {
    await applyPlanTool(db, 'upsert_feature', {
      title: 'First Feature',
      description: 'The first capability',
      rationale: 'the core',
      acceptance: ['works end to end'],
      order: 1,
    });
    const { data } = await onlyFeature();
    expect(data.title).toBe('First Feature');
    expect(data.status).toBe('proposed');
    expect(data.createdBy).toBe('studio');
    expect(data.rationale).toBe('the core');
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
