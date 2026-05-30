import type { AgentRole, Ref, Run, RunStatus, Step, StepStatus } from '@schemas';
import { advanceStep, type PhaseOutcome } from './step-machine.js';

export function nextRoleFor(step: Step): AgentRole | null {
  switch (step.status) {
    case 'building':
      return step.assignee === 'user' ? 'builder' : step.assignee;
    case 'testing':
      return 'tester';
    case 'auditing':
      return 'auditor';
    default:
      return null;
  }
}

export interface StepOutcome {
  status: StepStatus;
  attempts: number;
}

export function applyRunOutcome(step: Step, outcome: PhaseOutcome, maxAttempts: number): StepOutcome {
  const attempts = outcome === 'failed' ? step.attempts + 1 : step.attempts;
  return { status: advanceStep(step.status, outcome, attempts, maxAttempts), attempts };
}

export interface NewRun {
  role: AgentRole;
  target?: Ref;
  inputRefs: Ref[];
  status: Extract<RunStatus, 'queued'>;
  attemptNumber: number;
  createdAt: number;
}

export interface RunCompletion {
  runStatus: Extract<RunStatus, 'succeeded' | 'failed'>;
  step: StepOutcome;
  nextRun: NewRun | null;
}

export function planRunCompletion(
  run: Run,
  step: Step,
  outcome: PhaseOutcome,
  maxAttempts: number,
  now: number,
): RunCompletion {
  const stepOutcome = applyRunOutcome(step, outcome, maxAttempts);
  const role = nextRoleFor({ ...step, status: stepOutcome.status });
  const nextRun: NewRun | null = role
    ? {
        role,
        target: run.target,
        inputRefs: [],
        status: 'queued',
        attemptNumber: 1,
        createdAt: now,
      }
    : null;
  return {
    runStatus: outcome === 'succeeded' ? 'succeeded' : 'failed',
    step: stepOutcome,
    nextRun,
  };
}
