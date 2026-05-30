import { z } from 'zod';
import { IdSchema } from './id.js';

export const RunTaskSchema = z.object({
  runId: IdSchema,
});

export type RunTask = z.infer<typeof RunTaskSchema>;
