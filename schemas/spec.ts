import { z } from 'zod';
import { IdSchema } from './id.js';
import { TimestampSchema } from './timestamp.js';

export const SpecStatusSchema = z.enum(['active', 'superseded', 'expired']);

export type SpecStatus = z.infer<typeof SpecStatusSchema>;

export const SpecSchema = z.object({
  featureId: IdSchema,
  summary: z.string(),
  status: SpecStatusSchema,
  createdByRunId: IdSchema,
  supersededBy: IdSchema.optional(),
  createdAt: TimestampSchema,
});

export type Spec = z.infer<typeof SpecSchema>;
