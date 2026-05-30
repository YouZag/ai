import { z } from 'zod';
import { TimestampSchema } from './timestamp.js';

export const VisionSchema = z.object({
  statement: z.string(),
  principles: z.array(z.string()),
  nonGoals: z.array(z.string()),
  updatedAt: TimestampSchema,
});

export type Vision = z.infer<typeof VisionSchema>;
