/**
 * API Key Rate Limiting Middleware
 * Feature: RATE-004
 *
 * Provides API key-based authentication and rate limiting.
 * Includes per-key rate limits, usage tracking, and webhook notifications.
 */

import { Request, Response, NextFunction } from 'express';
import { createRateLimiter } from '../lib/ratelimit';
import { supabase } from '../lib/supabase';
import type { ApiKey, ApiKeyUsageNotification } from '@canvascast/shared';

/**
 * Rate limit result
 */
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Rate limit an API key based on its configuration
 */
export async function rateLimitByApiKey(apiKey: ApiKey): Promise<RateLimitResult> {
  const limiter = createRateLimiter({
    requests: apiKey.rate_limit_requests,
    window: apiKey.rate_limit_window,
    prefix: `ratelimit:apikey`,
  });

  const result = await limiter.limit(apiKey.id);

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

/**
 * Track API key usage in the database
 */
export async function trackApiKeyUsage(apiKeyId: string): Promise<void> {
  try {
    // Increment usage_count and update last_used_at
    await supabase
      .from('api_keys')
      .update({
        usage_count: supabase.sql`usage_count + 1`,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', apiKeyId);
  } catch (error) {
    console.error('[API_KEY_LIMIT] Failed to track usage:', error);
    // Don't throw - usage tracking shouldn't break the request
  }
}

/**
 * Check if usage exceeds threshold and should trigger webhook
 * Thresholds: 80%, 90%, 100%
 */
export async function checkApiKeyUsageThreshold(
  apiKey: ApiKey,
  currentUsage: number,
  limit: number
): Promise<boolean> {
  const percentage = (currentUsage / limit) * 100;

  // Determine which threshold was crossed
  let threshold: number | null = null;
  if (percentage >= 100) {
    threshold = 100;
  } else if (percentage >= 90) {
    threshold = 90;
  } else if (percentage >= 80) {
    threshold = 80;
  }

  if (threshold === null) {
    return false;
  }

  // Check if we've already sent a notification for this threshold in this window
  const windowResetAt = new Date(Date.now() + 60 * 60 * 1000); // Approximate, will be refined

  const { data: existing } = await supabase
    .from('api_key_usage_notifications')
    .select('id')
    .eq('api_key_id', apiKey.id)
    .eq('threshold_percentage', threshold)
    .gte('window_reset_at', new Date().toISOString())
    .single();

  if (existing) {
    // Already notified for this threshold in this window
    return false;
  }

  // Record the notification
  await supabase.from('api_key_usage_notifications').insert({
    api_key_id: apiKey.id,
    threshold_percentage: threshold,
    usage_count: currentUsage,
    limit,
    window_reset_at: windowResetAt.toISOString(),
  });

  return true;
}

/**
 * Send webhook notification about API key usage
 */
export async function sendUsageWebhook(
  apiKey: ApiKey,
  result: RateLimitResult
): Promise<void> {
  try {
    const percentage = ((result.limit - result.remaining) / result.limit) * 100;

    const payload = {
      api_key_id: apiKey.id,
      api_key_name: apiKey.name,
      threshold_percentage: Math.floor(percentage),
      usage_count: result.limit - result.remaining,
      limit: result.limit,
      remaining: result.remaining,
      window: apiKey.rate_limit_window,
      reset_at: new Date(result.reset).toISOString(),
      message: `API key "${apiKey.name}" has used ${Math.floor(percentage)}% of its rate limit`,
    };

    // In production, this would send to a webhook URL
    // For now, just log it
    console.log('[API_KEY_LIMIT] Usage webhook:', payload);

    // TODO: Implement actual webhook delivery
    // This could use a queue or direct HTTP POST to user's webhook URL
  } catch (error) {
    console.error('[API_KEY_LIMIT] Failed to send webhook:', error);
    // Don't throw - webhook failures shouldn't break the request
  }
}

/**
 * Verify API key from database
 */
async function verifyApiKey(keyString: string): Promise<ApiKey | null> {
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('key', keyString)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }

    // Check if expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return null;
    }

    return data as ApiKey;
  } catch (error) {
    console.error('[API_KEY_LIMIT] Error verifying API key:', error);
    return null;
  }
}

/**
 * Express middleware for API key authentication and rate limiting
 */
export function apiKeyAuthMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract API key from header
      const apiKeyHeader = req.headers['x-api-key'] as string | undefined;

      if (!apiKeyHeader) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'API key is required. Provide it in the X-API-Key header.',
        });
      }

      // Verify API key
      const apiKey = await verifyApiKey(apiKeyHeader);

      if (!apiKey) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid or expired API key.',
        });
      }

      // Apply rate limiting
      const rateLimitResult = await rateLimitByApiKey(apiKey);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', rateLimitResult.limit.toString());
      res.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
      res.setHeader('X-RateLimit-Reset', rateLimitResult.reset.toString());

      if (!rateLimitResult.success) {
        // Send webhook notification if at 100%
        await sendUsageWebhook(apiKey, rateLimitResult);

        return res.status(429).json({
          error: 'Rate Limit Exceeded',
          message: 'API key rate limit exceeded. Please try again later.',
          limit: rateLimitResult.limit,
          remaining: rateLimitResult.remaining,
          resetAt: new Date(rateLimitResult.reset).toISOString(),
        });
      }

      // Track usage
      await trackApiKeyUsage(apiKey.id);

      // Check if we should send threshold notifications
      const shouldNotify = await checkApiKeyUsageThreshold(
        apiKey,
        rateLimitResult.limit - rateLimitResult.remaining,
        rateLimitResult.limit
      );

      if (shouldNotify) {
        await sendUsageWebhook(apiKey, rateLimitResult);
      }

      // Attach API key to request for downstream use
      (req as any).apiKey = apiKey;

      next();
    } catch (error) {
      console.error('[API_KEY_LIMIT] Middleware error:', error);
      // Fail open to prevent blocking all requests
      next();
    }
  };
}

/**
 * Helper to mask API key for display (show only last 4 characters)
 */
export function maskApiKey(key: string): string {
  if (key.length <= 4) {
    return key;
  }
  return `${key.slice(0, 3)}****${key.slice(-4)}`;
}

/**
 * Generate a secure API key
 * Format: sk_<environment>_<random_string>
 */
export function generateApiKey(environment: 'test' | 'live' = 'live'): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const randomString = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `sk_${environment}_${randomString}`;
}
