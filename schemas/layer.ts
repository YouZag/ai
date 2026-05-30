import { z } from 'zod';

export const LayerSchema = z.enum(['schema', 'service', 'component']);

export type Layer = z.infer<typeof LayerSchema>;
