import type { Firestore } from 'firebase-admin/firestore';
import type { Step } from '@schemas';
import { RunSchema, StepSchema } from '@schemas';
import { zodConverter } from './converter.js';
import { planStepDispatch } from './reactor.js';

const runConverter = zodConverter(RunSchema);
const stepConverter = zodConverter(StepSchema);

async function depsAreDone(db: Firestore, step: Step): Promise<boolean> {
  if (step.dependsOn.length === 0) return true;
  const refs = step.dependsOn.map((id) => db.collection('steps').doc(id));
  const snaps = await db.getAll(...refs);
  return snaps.every((snap) => snap.get('status') === 'done');
}

export async function dispatchSteps(db: Firestore, now: number): Promise<{ dispatched: number }> {
  const control = await db.collection('control').doc('pipeline').get();
  if (control.get('phase') !== 'building') return { dispatched: 0 };

  const stepsCol = db.collection('steps').withConverter(stepConverter);
  const pending = await stepsCol.where('status', '==', 'pending').get();

  let dispatched = 0;
  for (const snap of pending.docs) {
    const step = snap.data();
    const plan = planStepDispatch(step, await depsAreDone(db, step));
    if (!plan) continue;

    const done = await db.runTransaction(async (tx) => {
      const fresh = (await tx.get(snap.ref)).data();
      if (!fresh || fresh.status !== 'pending') return false;
      tx.set(snap.ref, { ...fresh, status: plan.status });
      if (plan.role) {
        tx.set(db.collection('runs').doc().withConverter(runConverter), {
          role: plan.role,
          target: { kind: 'step', id: snap.id },
          inputRefs: [],
          status: 'queued',
          attemptNumber: 1,
          createdAt: now,
        });
      }
      return true;
    });
    if (done) dispatched++;
  }
  return { dispatched };
}
