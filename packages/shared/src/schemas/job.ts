import { z } from 'zod';
import { JOB_STATUSES } from '../types';

/**
 * Schema for creating a new job
 */
export const jobSchema = z.object({
  project_id: z.string().uuid('Project ID must be a valid UUID'),
  user_id: z.string().uuid('User ID must be a valid UUID'),
  status: z.enum(JOB_STATUSES as readonly [string, ...string[]], {
    errorMap: () => ({ message: 'Invalid job status' }),
  }),
  progress: z.number().min(0).max(100).default(0),
  error_code: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
  cost_credits_reserved: z.number().min(0).default(0),
  cost_credits_final: z.number().min(0).default(0),
});

/**
 * Schema for updating a job
 */
export const jobUpdateSchema = z.object({
  status: z.enum(JOB_STATUSES as readonly [string, ...string[]]).optional(),
  progress: z.number().min(0).max(100).optional(),
  error_code: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
  claimed_at: z.string().datetime().nullable().optional(),
  claimed_by: z.string().nullable().optional(),
  started_at: z.string().datetime().nullable().optional(),
  finished_at: z.string().datetime().nullable().optional(),
  cost_credits_final: z.number().min(0).optional(),
});

/**
 * Type exports
 */
export type JobInput = z.infer<typeof jobSchema>;
export type JobUpdate = z.infer<typeof jobUpdateSchema>;
