import { z } from 'zod';

export const AgentRoleSchema = z.enum([
  'reconciler',
  'architect',
  'strategist',
  'builder',
  'designer',
  'tester',
  'auditor',
  'optimizer',
  'supervisor',
]);

export type AgentRole = z.infer<typeof AgentRoleSchema>;
