import { z } from 'zod';

export const FeatureStatusSchema = z.enum(['proposed', 'planned', 'building', 'live', 'archived']);

export type FeatureStatus = z.infer<typeof FeatureStatusSchema>;

export const FeatureSchema = z.object({
  title: z.string(),
  description: z.string(),
  status: FeatureStatusSchema,
  priority: z.number(),
  createdBy: z.string(),
  supersededBy: z.string().optional(),
  createdAt: z.number(),
});

export type Feature = z.infer<typeof FeatureSchema>;
