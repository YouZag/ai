import { z } from 'zod';

export const SpecStatusSchema = z.enum(['active', 'superseded', 'expired']);

export type SpecStatus = z.infer<typeof SpecStatusSchema>;

export const SpecSchema = z.object({
  featureId: z.string(),
  summary: z.string(),
  status: SpecStatusSchema,
  createdByRunId: z.string(),
  supersededBy: z.string().optional(),
  createdAt: z.number(),
});

export type Spec = z.infer<typeof SpecSchema>;
