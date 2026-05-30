import { z } from 'zod';
import { AgentRoleSchema } from './agent-role.js';
import { IdSchema } from './id.js';
import { LayerSchema } from './layer.js';
import { TimestampSchema } from './timestamp.js';

export const StepKindSchema = z.enum(['add', 'amend', 'task']);

export type StepKind = z.infer<typeof StepKindSchema>;

export const StepStatusSchema = z.enum([
  'pending',
  'building',
  'testing',
  'auditing',
  'awaiting-user',
  'done',
  'blocked',
]);

export type StepStatus = z.infer<typeof StepStatusSchema>;

export const StepAssigneeSchema = z.union([
  AgentRoleSchema.extract(['builder', 'designer']),
  z.literal('user'),
]);

export type StepAssignee = z.infer<typeof StepAssigneeSchema>;

export const StepSchema = z.object({
  specId: IdSchema,
  featureId: IdSchema,
  title: z.string(),
  kind: StepKindSchema,
  layer: LayerSchema.optional(),
  assignee: StepAssigneeSchema,
  dependsOn: z.array(IdSchema),
  acceptance: z.array(z.string()),
  status: StepStatusSchema,
  attempts: z.number().int().nonnegative(),
  commitShas: z.array(z.string()),
  instruction: z.string().optional(),
  links: z.array(z.string()).optional(),
  createdAt: TimestampSchema,
});

export type Step = z.infer<typeof StepSchema>;
