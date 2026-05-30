import { z } from 'zod';
import { LayerSchema } from './layer.js';

export const ArchitectureNodeStatusSchema = z.enum(['active', 'superseded']);

export type ArchitectureNodeStatus = z.infer<typeof ArchitectureNodeStatusSchema>;

export const ArchitectureNodeSchema = z.object({
  kind: LayerSchema,
  name: z.string(),
  path: z.string(),
  dependsOn: z.array(z.string()),
  provenance: z.object({
    featureId: z.string().optional(),
    specId: z.string().optional(),
    runId: z.string().optional(),
  }),
  status: ArchitectureNodeStatusSchema,
  verifiedAt: z.number(),
  derived: z.literal(true),
});

export type ArchitectureNode = z.infer<typeof ArchitectureNodeSchema>;
