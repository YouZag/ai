import { z } from 'zod';
import { TimestampSchema } from './timestamp.js';

export const MetricSignalSchema = z.object({
  name: z.string(),
  value: z.number(),
  context: z.record(z.string(), z.unknown()).optional(),
  createdAt: TimestampSchema,
});

export type MetricSignal = z.infer<typeof MetricSignalSchema>;
