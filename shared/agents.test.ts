import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { seedAgents, exportAgents, DEFAULT_AGENTS } from './agents';

const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT = 'demo-ai';
const COUNT = Object.keys(DEFAULT_AGENTS).length;

let app: App;
let db: Firestore;

beforeAll(() => {
  app = initializeApp({ projectId: PROJECT }, 'agents-test');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

async function clear() {
  await fetch(`http://${EMULATOR}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, {
    method: 'DELETE',
  });
}

beforeEach(async () => {
  if (!EMULATOR) return;
  await clear();
});

describe.skipIf(!EMULATOR)('seedAgents and exportAgents against the emulator', () => {
  it('seeds the default agents as active', async () => {
    expect(await seedAgents(db, 1000)).toEqual({ created: COUNT });
    const agents = await db.collection('agents').get();
    expect(agents.size).toBe(COUNT);
    expect(agents.docs.every((d) => d.data().status === 'active')).toBe(true);
    expect((await db.collection('agents').doc('builder').get()).data()?.role).toBe('builder');
  });

  it('is idempotent and preserves runtime edits', async () => {
    await seedAgents(db, 1000);
    await db.collection('agents').doc('builder').set({ instructions: 'tuned' }, { merge: true });
    expect(await seedAgents(db, 2000)).toEqual({ created: 0 });
    expect((await db.collection('agents').doc('builder').get()).data()?.instructions).toBe('tuned');
  });

  it('exports a portable bundle that can reseed another project', async () => {
    await seedAgents(db, 1000);
    const bundle = await exportAgents(db);
    expect(Object.keys(bundle).sort()).toEqual(Object.keys(DEFAULT_AGENTS).sort());
    expect(bundle.builder).not.toHaveProperty('status');
    expect(bundle.builder).not.toHaveProperty('createdAt');

    await clear();
    expect(await seedAgents(db, 3000, bundle)).toEqual({ created: COUNT });
  });
});
