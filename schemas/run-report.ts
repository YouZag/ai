import { z } from 'zod';

export const RunReportSchema = z.object({
  outcome: z.enum(['succeeded', 'failed']),
  summary: z.string(),
});

export type RunReport = z.infer<typeof RunReportSchema>;
