import { z } from 'zod';
import { TimestampSchema } from './timestamp.js';

export const PipelinePhaseSchema = z.enum(['planning', 'building', 'paused']);

export type PipelinePhase = z.infer<typeof PipelinePhaseSchema>;

export const ControlSchema = z.object({
  phase: PipelinePhaseSchema,
  updatedAt: TimestampSchema,
});

export type Control = z.infer<typeof ControlSchema>;
