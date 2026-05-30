import { z } from 'zod';
import { TimestampSchema } from './timestamp.js';

export const DirectiveStatusSchema = z.enum(['active', 'consumed', 'expired']);

export type DirectiveStatus = z.infer<typeof DirectiveStatusSchema>;

export const DirectiveSchema = z.object({
  scope: z.string(),
  instruction: z.string(),
  status: DirectiveStatusSchema,
  createdAt: TimestampSchema,
});

export type Directive = z.infer<typeof DirectiveSchema>;
