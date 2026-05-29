import { z } from 'zod';

export const ErrorDocumentSchema = z.object({
  message: z.string(),
  stack: z.string().optional(),
  source: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.number(),
});

export type ErrorDocument = z.infer<typeof ErrorDocumentSchema>;
