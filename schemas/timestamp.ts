import { z } from 'zod';

export const TimestampSchema = z.number().int().nonnegative();

export type Timestamp = z.infer<typeof TimestampSchema>;
