import { z } from 'zod';
import { AgentRoleSchema } from './agent-role.js';
import { RefSchema } from './ref.js';
import { TimestampSchema } from './timestamp.js';

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
  target: RefSchema,
  inputRefs: z.array(RefSchema),
  status: RunStatusSchema,
  attemptNumber: z.number().int().nonnegative(),
  leasedUntil: TimestampSchema.optional(),
  failureClass: z.string().optional(),
  failureReason: z.string().optional(),
  model: z.string().optional(),
  tokens: z.number().int().nonnegative().optional(),
  costUsd: z.number().nonnegative().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  summary: z.string().optional(),
  startedAt: TimestampSchema.optional(),
  finishedAt: TimestampSchema.optional(),
  createdAt: TimestampSchema,
});

export type Run = z.infer<typeof RunSchema>;
