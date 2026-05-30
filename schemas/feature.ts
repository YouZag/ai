import { z } from 'zod';
import { IdSchema } from './id.js';
import { TimestampSchema } from './timestamp.js';

export const FeatureStatusSchema = z.enum(['proposed', 'planned', 'building', 'live', 'archived']);

export type FeatureStatus = z.infer<typeof FeatureStatusSchema>;

export const FeatureSchema = z.object({
  title: z.string(),
  description: z.string(),
  rationale: z.string().optional(),
  acceptance: z.array(z.string()).optional(),
  dependsOn: z.array(IdSchema).optional(),
  order: z.number().int().optional(),
  status: FeatureStatusSchema,
  priority: z.number().int().nonnegative(),
  createdBy: z.string(),
  supersededBy: IdSchema.optional(),
  createdAt: TimestampSchema,
});

export type Feature = z.infer<typeof FeatureSchema>;
