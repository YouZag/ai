import { z } from 'zod';
import { AgentRoleSchema } from './agent-role.js';
import { LayerSchema } from './layer.js';

export const StepKindSchema = z.enum(['add', 'amend', 'human']);

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

export const StepAssigneeSchema = z.union([AgentRoleSchema, z.literal('user')]);

export type StepAssignee = z.infer<typeof StepAssigneeSchema>;

export const StepSchema = z.object({
  specId: z.string(),
  featureId: z.string(),
  title: z.string(),
  kind: StepKindSchema,
  layer: LayerSchema.optional(),
  assignee: StepAssigneeSchema,
  dependsOn: z.array(z.string()),
  acceptance: z.array(z.string()),
  status: StepStatusSchema,
  attempts: z.number(),
  commitShas: z.array(z.string()),
  instruction: z.string().optional(),
  links: z.array(z.string()).optional(),
  createdAt: z.number(),
});

export type Step = z.infer<typeof StepSchema>;
