import type { AgentRole, Step, StepStatus } from '@schemas';
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
