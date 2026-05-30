import { z } from 'zod';
import { AgentRoleSchema } from './agent-role.js';
import { TimestampSchema } from './timestamp.js';

export const AgentStatusSchema = z.enum(['active', 'retired']);

export type AgentStatus = z.infer<typeof AgentStatusSchema>;

export const AgentDefinitionSchema = z.object({
  role: AgentRoleSchema,
  title: z.string(),
  instructions: z.string(),
  tools: z.array(z.string()),
  model: z.string().optional(),
  maxTurns: z.number().int().positive().optional(),
  status: AgentStatusSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;
