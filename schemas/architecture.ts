import { z } from 'zod';
import { IdSchema } from './id.js';
import { LayerSchema } from './layer.js';
import { TimestampSchema } from './timestamp.js';

export const ArchitectureNodeStatusSchema = z.enum(['active', 'superseded']);

export type ArchitectureNodeStatus = z.infer<typeof ArchitectureNodeStatusSchema>;

export const ArchitectureNodeSchema = z.object({
  kind: LayerSchema,
  name: z.string(),
  path: z.string(),
  dependsOn: z.array(IdSchema),
  provenance: z.object({
    runId: IdSchema,
    featureId: IdSchema.optional(),
    specId: IdSchema.optional(),
  }),
  status: ArchitectureNodeStatusSchema,
  verifiedAt: TimestampSchema,
});

export type ArchitectureNode = z.infer<typeof ArchitectureNodeSchema>;
