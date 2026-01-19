import { z } from 'zod';
import { NICHE_PRESETS } from '../types';

// Extract valid niche preset IDs
const nichePresetIds = NICHE_PRESETS.map(p => p.id) as [string, ...string[]];

/**
 * Schema for creating a new project
 */
export const projectSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  niche_preset: z.enum(nichePresetIds, {
    errorMap: () => ({ message: 'Invalid niche preset' }),
  }),
  target_minutes: z.number()
    .int('Target duration must be a whole number')
    .min(1, 'Target duration must be at least 1 minute')
    .max(10, 'Target duration must be at most 10 minutes'),
  prompt: z.string().optional(),
});

/**
 * Schema for updating a project
 */
export const projectUpdateSchema = projectSchema.partial();

/**
 * Type exports
 */
export type ProjectInput = z.infer<typeof projectSchema>;
export type ProjectUpdate = z.infer<typeof projectUpdateSchema>;
