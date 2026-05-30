import { describe, it, expect } from 'vitest';
import { needsWorkspace } from './workspace';

describe('needsWorkspace', () => {
  it('requires a working tree for the code-execution roles', () => {
    for (const role of ['builder', 'designer', 'tester', 'auditor']) {
      expect(needsWorkspace(role)).toBe(true);
    }
  });

  it('does not for the planning and meta roles', () => {
    for (const role of ['reconciler', 'architect', 'strategist', 'optimizer', 'supervisor']) {
      expect(needsWorkspace(role)).toBe(false);
    }
  });
});
