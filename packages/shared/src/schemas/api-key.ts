/**
 * API Key Validation Schemas
 * Feature: RATE-004
 *
 * Zod schemas for API key creation, validation, and usage tracking.
 */

import { z } from 'zod';

/**
 * Schema for creating a new API key
 */
export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  rate_limit_requests: z.number().int().min(1).max(10000).default(100),
  rate_limit_window: z
    .string()
    .regex(/^\d+[smhd]$/, 'Window must be in format: 1m, 1h, 1d')
    .default('1h'),
  expires_at: z.string().datetime().optional(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

/**
 * Schema for updating an API key
 */
export const updateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  rate_limit_requests: z.number().int().min(1).max(10000).optional(),
  rate_limit_window: z
    .string()
    .regex(/^\d+[smhd]$/, 'Window must be in format: 1m, 1h, 1d')
    .optional(),
  is_active: z.boolean().optional(),
  expires_at: z.string().datetime().nullable().optional(),
});

export type UpdateApiKeyInput = z.infer<typeof updateApiKeySchema>;

/**
 * Schema for API key in responses
 */
export const apiKeySchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  key: z.string(), // Only returned during creation
  name: z.string(),
  description: z.string().nullable().optional(),
  rate_limit_requests: z.number(),
  rate_limit_window: z.string(),
  usage_count: z.number(),
  last_used_at: z.string().datetime().nullable(),
  is_active: z.boolean(),
  expires_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

/**
 * Schema for masked API key (for listing)
 */
export const maskedApiKeySchema = apiKeySchema.omit({ key: true }).extend({
  key_preview: z.string(), // e.g., "sk_****abc123"
});

export type MaskedApiKey = z.infer<typeof maskedApiKeySchema>;

/**
 * Schema for usage notification webhook payload
 */
export const usageNotificationSchema = z.object({
  api_key_id: z.string().uuid(),
  api_key_name: z.string(),
  threshold_percentage: z.number(),
  usage_count: z.number(),
  limit: z.number(),
  remaining: z.number(),
  window: z.string(),
  reset_at: z.string().datetime(),
  message: z.string(),
});

export type UsageNotificationPayload = z.infer<typeof usageNotificationSchema>;
