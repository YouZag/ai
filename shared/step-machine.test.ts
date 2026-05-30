import { describe, it, expect } from 'vitest';
import type { Step } from '@schemas';
import {
  canTransitionStep,
  isStepTerminal,
  isUserStep,
  depsSatisfied,
  startStep,
  advanceStep,
} from './step-machine';

function step(overrides: Partial<Step> = {}): Step {
  return {
    specId: 'spec1',
    featureId: 'feat1',
    title: 'do a thing',
    kind: 'add',
    assignee: 'builder',
    dependsOn: [],
    acceptance: [],
    status: 'pending',
    attempts: 0,
    commitShas: [],
    createdAt: 0,
    ...overrides,
  };
}

describe('canTransitionStep', () => {
  it('walks the happy path build to test to audit to done', () => {
    expect(canTransitionStep('pending', 'building')).toBe(true);
    expect(canTransitionStep('building', 'testing')).toBe(true);
    expect(canTransitionStep('testing', 'auditing')).toBe(true);
    expect(canTransitionStep('auditing', 'done')).toBe(true);
  });
  it('lets audit loop back to building (the audit fixed point)', () => {
    expect(canTransitionStep('auditing', 'building')).toBe(true);
  });
  it('rejects skipping straight from pending to done', () => {
    expect(canTransitionStep('pending', 'done')).toBe(false);
  });
});

describe('isStepTerminal', () => {
  it('treats done as terminal and blocked as recoverable', () => {
    expect(isStepTerminal('done')).toBe(true);
    expect(isStepTerminal('blocked')).toBe(false);
  });
});

describe('isUserStep', () => {
  it('detects human steps by assignee', () => {
    expect(isUserStep(step({ assignee: 'user' }))).toBe(true);
    expect(isUserStep(step({ assignee: 'builder' }))).toBe(false);
  });
});

describe('depsSatisfied', () => {
  it('requires every dependency to be complete', () => {
    const s = step({ dependsOn: ['a', 'b'] });
    expect(depsSatisfied(s, new Set(['a', 'b']))).toBe(true);
    expect(depsSatisfied(s, new Set(['a']))).toBe(false);
  });
  it('is trivially satisfied with no dependencies', () => {
    expect(depsSatisfied(step(), new Set())).toBe(true);
  });
});

describe('startStep', () => {
  it('routes human steps to awaiting-user and agent steps to building', () => {
    expect(startStep(step({ assignee: 'user' }))).toBe('awaiting-user');
    expect(startStep(step({ assignee: 'designer' }))).toBe('building');
  });
});

describe('advanceStep', () => {
  it('advances through the phases on success', () => {
    expect(advanceStep('building', 'succeeded', 1, 3)).toBe('testing');
    expect(advanceStep('testing', 'succeeded', 1, 3)).toBe('auditing');
    expect(advanceStep('auditing', 'succeeded', 1, 3)).toBe('done');
  });
  it('routes failures back to building while attempts remain', () => {
    expect(advanceStep('testing', 'failed', 1, 3)).toBe('building');
    expect(advanceStep('auditing', 'failed', 2, 3)).toBe('building');
  });
  it('blocks once attempts are exhausted', () => {
    expect(advanceStep('building', 'failed', 3, 3)).toBe('blocked');
  });
});
