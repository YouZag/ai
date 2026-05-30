import { z } from 'zod';
import { AgentRoleSchema } from './agent-role.js';

export const RunStatusSchema = z.enum([
  'queued',
  'leased',
  'running',
  'succeeded',
  'failed',
  'timed_out',
  'abandoned',
]);

export type RunStatus = z.infer<typeof RunStatusSchema>;

export const RunSchema = z.object({
  role: AgentRoleSchema,
  targetRef: z.string().optional(),
  inputRefs: z.array(z.string()),
  status: RunStatusSchema,
  attempt: z.number(),
  leasedUntil: z.number().optional(),
  failureClass: z.string().optional(),
  failureReason: z.string().optional(),
  model: z.string().optional(),
  tokens: z.number().optional(),
  costUsd: z.number().optional(),
  durationMs: z.number().optional(),
  summary: z.string().optional(),
  startedAt: z.number().optional(),
  finishedAt: z.number().optional(),
  createdAt: z.number(),
});

export type Run = z.infer<typeof RunSchema>;
