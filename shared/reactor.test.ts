import { describe, it, expect } from 'vitest';
import type { Step } from '@schemas';
import { nextRoleFor, applyRunOutcome } from './reactor';

function step(overrides: Partial<Step> = {}): Step {
  return {
    specId: 'spec1',
    featureId: 'feat1',
    title: 'do a thing',
    kind: 'add',
    assignee: 'builder',
    dependsOn: [],
    acceptance: [],
    status: 'building',
    attempts: 0,
    commitShas: [],
    createdAt: 0,
    ...overrides,
  };
}

describe('nextRoleFor', () => {
  it('routes the build phase to the step assignee', () => {
    expect(nextRoleFor(step({ status: 'building', assignee: 'builder' }))).toBe('builder');
    expect(nextRoleFor(step({ status: 'building', assignee: 'designer' }))).toBe('designer');
  });
  it('routes the test and audit phases to tester and auditor', () => {
    expect(nextRoleFor(step({ status: 'testing' }))).toBe('tester');
    expect(nextRoleFor(step({ status: 'auditing' }))).toBe('auditor');
  });
  it('has no next role for terminal or waiting states', () => {
    expect(nextRoleFor(step({ status: 'done' }))).toBeNull();
    expect(nextRoleFor(step({ status: 'blocked' }))).toBeNull();
    expect(nextRoleFor(step({ status: 'awaiting-user' }))).toBeNull();
    expect(nextRoleFor(step({ status: 'pending' }))).toBeNull();
  });
});

describe('applyRunOutcome', () => {
  it('advances the step and preserves attempts on success', () => {
    expect(applyRunOutcome(step({ status: 'building', attempts: 1 }), 'succeeded', 3)).toEqual({
      status: 'testing',
      attempts: 1,
    });
  });
  it('bumps attempts and loops back to building on failure', () => {
    expect(applyRunOutcome(step({ status: 'testing', attempts: 1 }), 'failed', 3)).toEqual({
      status: 'building',
      attempts: 2,
    });
  });
  it('blocks once the bumped attempts reach the ceiling', () => {
    expect(applyRunOutcome(step({ status: 'building', attempts: 2 }), 'failed', 3)).toEqual({
      status: 'blocked',
      attempts: 3,
    });
  });
});
