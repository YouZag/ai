import { z } from 'zod';

export const MetricSignalSchema = z.object({
  name: z.string(),
  value: z.number(),
  context: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.number(),
});

export type MetricSignal = z.infer<typeof MetricSignalSchema>;
