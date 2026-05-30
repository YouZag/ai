import { z } from 'zod';
import { IdSchema } from './id.js';

export const RefKindSchema = z.enum([
  'vision',
  'feature',
  'spec',
  'step',
  'run',
  'architecture',
  'repo',
]);

export type RefKind = z.infer<typeof RefKindSchema>;

export const RefSchema = z.object({
  kind: RefKindSchema,
  id: IdSchema,
});

export type Ref = z.infer<typeof RefSchema>;
