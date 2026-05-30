import type { Run, RunStatus } from '@schemas';

export const DEFAULT_LEASE_MS = 10 * 60 * 1000;
export const DEFAULT_MAX_ATTEMPTS = 3;

const RUN_TRANSITIONS: Record<RunStatus, readonly RunStatus[]> = {
  queued: ['leased', 'abandoned'],
  leased: ['running', 'abandoned', 'timed_out'],
  running: ['succeeded', 'failed', 'timed_out', 'abandoned'],
  succeeded: [],
  failed: [],
  timed_out: [],
  abandoned: [],
};

export function canTransitionRun(from: RunStatus, to: RunStatus): boolean {
  return RUN_TRANSITIONS[from].includes(to);
}

export function isRunTerminal(status: RunStatus): boolean {
  return RUN_TRANSITIONS[status].length === 0;
}

export interface LeasePatch {
  status: Extract<RunStatus, 'leased'>;
  leasedUntil: number;
}

export function leaseRun(run: Run, now: number, leaseMs: number = DEFAULT_LEASE_MS): LeasePatch {
  if (run.status !== 'queued') {
    throw new Error(`cannot lease a run in status "${run.status}"`);
  }
  return { status: 'leased', leasedUntil: now + leaseMs };
}

export function isLeaseExpired(run: Run, now: number): boolean {
  if (run.status !== 'leased' && run.status !== 'running') return false;
  return run.leasedUntil !== undefined && run.leasedUntil <= now;
}

export interface ReapResult {
  status: Extract<RunStatus, 'abandoned'>;
  retryable: boolean;
}

export function reapRun(
  run: Run,
  now: number,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
): ReapResult | null {
  if (!isLeaseExpired(run, now)) return null;
  return { status: 'abandoned', retryable: run.attemptNumber < maxAttempts };
}
