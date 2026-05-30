import { z } from 'zod';

export const ActivitySchema = z.object({
  kind: z.string(),
  message: z.string(),
  refs: z.array(z.string()).optional(),
  createdAt: z.number(),
});

export type Activity = z.infer<typeof ActivitySchema>;
