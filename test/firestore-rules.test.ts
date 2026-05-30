import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { addDoc, collection, doc, getDoc, setDoc } from 'firebase/firestore';

const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST;

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  if (!EMULATOR) return;
  const [host, port] = EMULATOR.split(':');
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  if (testEnv) await testEnv.clearFirestore();
});

const admin = () =>
  testEnv
    .authenticatedContext('admin', { email: 'drew@youzag.com', email_verified: true })
    .firestore();
const outsider = () =>
  testEnv
    .authenticatedContext('rando', { email: 'nope@example.com', email_verified: true })
    .firestore();
const anon = () => testEnv.unauthenticatedContext().firestore();

const agent = {
  role: 'builder',
  title: 'B',
  instructions: 'i',
  tools: [],
  status: 'active',
  createdAt: 0,
  updatedAt: 0,
};

describe.skipIf(!EMULATOR)('firestore.rules', () => {
  it('lets an admin author direction and report errors, and read the pipeline', async () => {
    const db = admin();
    await assertSucceeds(
      setDoc(doc(db, 'vision/current'), { statement: 'x', principles: [], nonGoals: [], updatedAt: 0 }),
    );
    await assertSucceeds(
      addDoc(collection(db, 'features'), {
        title: 't',
        description: '',
        status: 'proposed',
        priority: 0,
        createdBy: 'a',
        createdAt: 0,
      }),
    );
    await assertSucceeds(setDoc(doc(db, 'agents/builder'), agent));
    await assertSucceeds(addDoc(collection(db, 'errors'), { message: 'boom', createdAt: 0 }));
    await assertSucceeds(getDoc(doc(db, 'runs/r1')));
  });

  it('blocks outsiders and anonymous users everywhere', async () => {
    for (const db of [outsider(), anon()]) {
      await assertFails(getDoc(doc(db, 'features/f1')));
      await assertFails(setDoc(doc(db, 'agents/builder'), agent));
      await assertFails(addDoc(collection(db, 'errors'), { message: 'x', createdAt: 0 }));
    }
  });

  it('keeps the pipeline collections server-only, even for an admin', async () => {
    const db = admin();
    await assertFails(setDoc(doc(db, 'runs/r1'), { status: 'queued' }));
    await assertFails(setDoc(doc(db, 'steps/s1'), { status: 'pending' }));
  });
});
