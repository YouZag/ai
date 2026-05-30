import { describe, it, expect } from 'vitest';
import type { Run, Step } from '@schemas';
import { nextRoleFor, applyRunOutcome, planRunCompletion, planStepDispatch } from './reactor';

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

function run(overrides: Partial<Run> = {}): Run {
  return {
    role: 'builder',
    target: { kind: 'step', id: 'step1' },
    inputRefs: [],
    status: 'running',
    attemptNumber: 1,
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

describe('planRunCompletion', () => {
  it('completes a successful build and queues the test run on the same target', () => {
    const result = planRunCompletion(
      run({ target: { kind: 'step', id: 'step1' } }),
      step({ status: 'building', attempts: 0 }),
      'succeeded',
      3,
      1000,
    );
    expect(result.runStatus).toBe('succeeded');
    expect(result.step).toEqual({ status: 'testing', attempts: 0 });
    expect(result.nextRun).toEqual({
      role: 'tester',
      target: { kind: 'step', id: 'step1' },
      inputRefs: [],
      status: 'queued',
      attemptNumber: 1,
      createdAt: 1000,
    });
  });
  it('loops a failed test back to a build run for the step assignee', () => {
    const result = planRunCompletion(
      run(),
      step({ status: 'testing', attempts: 1, assignee: 'designer' }),
      'failed',
      3,
      0,
    );
    expect(result.runStatus).toBe('failed');
    expect(result.step).toEqual({ status: 'building', attempts: 2 });
    expect(result.nextRun?.role).toBe('designer');
  });
  it('blocks at the attempt ceiling with no next run', () => {
    const result = planRunCompletion(run(), step({ status: 'auditing', attempts: 2 }), 'failed', 3, 0);
    expect(result.step).toEqual({ status: 'blocked', attempts: 3 });
    expect(result.nextRun).toBeNull();
  });
  it('finishes a passing audit with no next run', () => {
    const result = planRunCompletion(run(), step({ status: 'auditing', attempts: 0 }), 'succeeded', 3, 0);
    expect(result.step).toEqual({ status: 'done', attempts: 0 });
    expect(result.nextRun).toBeNull();
  });
});

describe('planStepDispatch', () => {
  it('does not dispatch a pending step whose deps are unmet', () => {
    expect(planStepDispatch(step({ status: 'pending' }), false)).toBeNull();
  });
  it('does not dispatch a step that is not pending', () => {
    expect(planStepDispatch(step({ status: 'building' }), true)).toBeNull();
  });
  it('sends a ready agent step to building with its role', () => {
    expect(planStepDispatch(step({ status: 'pending', assignee: 'designer' }), true)).toEqual({
      status: 'building',
      role: 'designer',
    });
  });
  it('sends a ready human step to awaiting-user with no role', () => {
    expect(planStepDispatch(step({ status: 'pending', assignee: 'user' }), true)).toEqual({
      status: 'awaiting-user',
      role: null,
    });
  });
});
