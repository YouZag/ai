import { z } from 'zod';

export const VisionSchema = z.object({
  statement: z.string(),
  principles: z.array(z.string()),
  nonGoals: z.array(z.string()),
  updatedAt: z.number(),
});

export type Vision = z.infer<typeof VisionSchema>;
