import { describe, it, expect } from 'vitest';
import type { Run } from '@schemas';
import {
  canTransitionRun,
  isRunTerminal,
  leaseRun,
  isLeaseExpired,
  reapRun,
  DEFAULT_LEASE_MS,
} from './run-machine';

function run(overrides: Partial<Run> = {}): Run {
  return {
    role: 'builder',
    target: { kind: 'step', id: 's1' },
    inputRefs: [],
    status: 'queued',
    attemptNumber: 1,
    createdAt: 0,
    ...overrides,
  };
}

describe('canTransitionRun', () => {
  it('allows queued to leased', () => {
    expect(canTransitionRun('queued', 'leased')).toBe(true);
  });
  it('rejects queued straight to running', () => {
    expect(canTransitionRun('queued', 'running')).toBe(false);
  });
  it('allows running to its outcomes', () => {
    expect(canTransitionRun('running', 'succeeded')).toBe(true);
    expect(canTransitionRun('running', 'failed')).toBe(true);
  });
  it('rejects leaving a terminal status', () => {
    expect(canTransitionRun('succeeded', 'running')).toBe(false);
  });
});

describe('isRunTerminal', () => {
  it('treats outcome statuses as terminal', () => {
    expect(isRunTerminal('succeeded')).toBe(true);
    expect(isRunTerminal('failed')).toBe(true);
    expect(isRunTerminal('timed_out')).toBe(true);
    expect(isRunTerminal('abandoned')).toBe(true);
  });
  it('treats active statuses as non-terminal', () => {
    expect(isRunTerminal('queued')).toBe(false);
    expect(isRunTerminal('leased')).toBe(false);
    expect(isRunTerminal('running')).toBe(false);
  });
});

describe('leaseRun', () => {
  it('leases a queued run for the given duration', () => {
    expect(leaseRun(run({ status: 'queued' }), 1000, 5000)).toEqual({
      status: 'leased',
      leasedUntil: 6000,
    });
  });
  it('applies the default lease when none is given', () => {
    expect(leaseRun(run({ status: 'queued' }), 0).leasedUntil).toBe(DEFAULT_LEASE_MS);
  });
  it('refuses to lease a run that is not queued', () => {
    expect(() => leaseRun(run({ status: 'running' }), 0)).toThrow();
  });
});

describe('isLeaseExpired', () => {
  it('is true when a held lease has passed', () => {
    expect(isLeaseExpired(run({ status: 'leased', leasedUntil: 100 }), 200)).toBe(true);
  });
  it('is false when the lease is still in the future', () => {
    expect(isLeaseExpired(run({ status: 'leased', leasedUntil: 300 }), 200)).toBe(false);
  });
  it('is false for a run that holds no lease', () => {
    expect(isLeaseExpired(run({ status: 'queued' }), 200)).toBe(false);
  });
});

describe('reapRun', () => {
  it('abandons an expired run, retryable below the attempt ceiling', () => {
    expect(reapRun(run({ status: 'running', leasedUntil: 100, attemptNumber: 1 }), 200, 3)).toEqual({
      status: 'abandoned',
      retryable: true,
    });
  });
  it('abandons without retry once attempts are exhausted', () => {
    expect(reapRun(run({ status: 'running', leasedUntil: 100, attemptNumber: 3 }), 200, 3)).toEqual({
      status: 'abandoned',
      retryable: false,
    });
  });
  it('leaves a live lease untouched', () => {
    expect(reapRun(run({ status: 'leased', leasedUntil: 999 }), 200, 3)).toBeNull();
  });
});
