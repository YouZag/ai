import { z } from 'zod';
import { TimestampSchema } from './timestamp.js';

export const ActivitySchema = z.object({
  kind: z.string(),
  message: z.string(),
  refs: z.array(z.string()).optional(),
  createdAt: TimestampSchema,
});

export type Activity = z.infer<typeof ActivitySchema>;
