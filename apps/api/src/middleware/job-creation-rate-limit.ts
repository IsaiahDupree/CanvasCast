/**
 * RATE-003: Job Creation Rate Limit Middleware
 *
 * Applies per-user rate limiting to job creation endpoints with
 * configurable limits based on subscription tier.
 */

import type { Request, Response, NextFunction } from 'express';
import { rateLimitByUser } from '../lib/ratelimit.js';
import { getUserRateLimitConfig } from '../services/rate-limit-tier.js';
import { createClient } from '@supabase/supabase-js';

/**
 * Authenticated request with user information
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

/**
 * Middleware to enforce rate limits on job creation per user
 *
 * This middleware:
 * 1. Determines the user's rate limit tier (free, starter, pro, creator_plus)
 * 2. Applies the appropriate rate limit
 * 3. Returns 429 with retry information if limit exceeded
 * 4. Sets rate limit headers in response
 */
export function jobCreationRateLimit() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Ensure user is authenticated
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user.id;

      // Create Supabase client
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Get user's rate limit configuration based on their tier
      const config = await getUserRateLimitConfig(supabase, userId);

      // Apply rate limit
      const result = await rateLimitByUser(userId, config);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', result.limit.toString());
      res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
      res.setHeader('X-RateLimit-Reset', result.reset.toString());
      res.setHeader('X-RateLimit-Tier', config.tier);

      // Check if rate limit exceeded
      if (!result.success) {
        const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);

        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: `You have exceeded your job creation limit for the ${config.tier} tier. Please try again later.`,
          limit: result.limit,
          remaining: result.remaining,
          reset: result.reset,
          retryAfter,
          tier: config.tier,
        });
      }

      // Rate limit check passed, continue to next middleware
      next();
    } catch (error) {
      console.error('[RATE-LIMIT] Error checking job creation rate limit:', error);

      // Fail open - don't block users on rate limit errors
      // This ensures the service remains available even if rate limiting fails
      next();
    }
  };
}

/**
 * Express middleware factory that can be used directly in route definitions
 *
 * Usage:
 * ```
 * app.post('/api/v1/projects', authenticateToken, jobCreationRateLimitMiddleware, handler);
 * ```
 */
export const jobCreationRateLimitMiddleware = jobCreationRateLimit();
