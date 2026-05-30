import type { Step, StepStatus } from '@schemas';

const STEP_TRANSITIONS: Record<StepStatus, readonly StepStatus[]> = {
  pending: ['building', 'awaiting-user', 'blocked'],
  building: ['testing', 'building', 'blocked', 'awaiting-user'],
  testing: ['auditing', 'building', 'blocked'],
  auditing: ['done', 'building', 'blocked'],
  'awaiting-user': ['building', 'pending', 'done', 'blocked'],
  done: [],
  blocked: ['pending', 'building'],
};

export function canTransitionStep(from: StepStatus, to: StepStatus): boolean {
  return STEP_TRANSITIONS[from].includes(to);
}

export function isStepTerminal(status: StepStatus): boolean {
  return STEP_TRANSITIONS[status].length === 0;
}

export function isUserStep(step: Step): boolean {
  return step.assignee === 'user';
}

export function depsSatisfied(step: Step, completedStepIds: ReadonlySet<string>): boolean {
  return step.dependsOn.every((id) => completedStepIds.has(id));
}

export type PhaseOutcome = 'succeeded' | 'failed';

export function startStep(step: Step): Extract<StepStatus, 'building' | 'awaiting-user'> {
  return isUserStep(step) ? 'awaiting-user' : 'building';
}

export function advanceStep(
  status: StepStatus,
  outcome: PhaseOutcome,
  attempts: number,
  maxAttempts: number,
): StepStatus {
  if (outcome === 'succeeded') {
    if (status === 'building') return 'testing';
    if (status === 'testing') return 'auditing';
    if (status === 'auditing') return 'done';
    return status;
  }
  if (attempts >= maxAttempts) return 'blocked';
  return 'building';
}
