import type { Firestore } from 'firebase-admin/firestore';
import { RunSchema } from '@schemas';
import { zodConverter } from './converter.js';

const runConverter = zodConverter(RunSchema);

export function becamePlanned(before: string | undefined, after: string | undefined): boolean {
  return after === 'planned' && before !== 'planned';
}

export async function planFeature(db: Firestore, featureId: string, now: number): Promise<string> {
  const created = await db
    .collection('runs')
    .withConverter(runConverter)
    .add({
      role: 'strategist',
      target: { kind: 'feature', id: featureId },
      inputRefs: [],
      status: 'queued',
      attemptNumber: 1,
      createdAt: now,
    });
  return created.id;
}
