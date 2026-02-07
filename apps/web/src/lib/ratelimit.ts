/**
 * Upstash Rate Limiting for Next.js Web App
 *
 * Provides rate limiting functionality using Upstash Redis.
 * Supports IP-based rate limiting for API routes.
 *
 * Feature: RATE-001, RATE-002
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { InMemoryRateLimiter } from './in-memory-ratelimiter';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  requests: number;
  window: string; // e.g., '1m', '1h', '10s'
  prefix?: string;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

let redisClient: Redis | InMemoryRateLimiter | null = null;
let inMemoryLimiter: InMemoryRateLimiter | null = null;

/**
 * Get or create Redis client for Upstash
 */
function getUpstashRedis(): Redis {
  if (redisClient) {
    return redisClient as Redis;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    // Fallback to in-memory rate limiter for development and testing
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      console.warn('[RATELIMIT] ⚠️  UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set, using in-memory rate limiter');

      if (!inMemoryLimiter) {
        inMemoryLimiter = new InMemoryRateLimiter();
      }

      redisClient = inMemoryLimiter as any;
      return inMemoryLimiter as any as Redis;
    }

    throw new Error(
      'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in production'
    );
  }

  const redis = new Redis({
    url,
    token,
  });

  redisClient = redis;
  return redis;
}

/**
 * Parse time window string to milliseconds
 */
function parseWindow(window: string): number {
  const match = window.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid window format: ${window}. Use format like "1m", "1h", "10s"`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
}

/**
 * Create a rate limiter instance
 */
export function createRateLimiter(config: RateLimitConfig): Ratelimit {
  if (config.requests <= 0) {
    throw new Error('Requests must be a positive number');
  }

  const redis = getUpstashRedis();
  const windowMs = parseWindow(config.window);

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.requests, `${windowMs} ms`),
    analytics: true,
    prefix: config.prefix || 'ratelimit',
  });
}

/**
 * Rate limit by IP address
 */
export async function rateLimitByIP(
  ip: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const limiter = createRateLimiter({
    ...config,
    prefix: config.prefix || 'ratelimit:ip',
  });

  const result = await limiter.limit(ip);

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

/**
 * Rate limit by user ID
 */
export async function rateLimitByUser(
  userId: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const limiter = createRateLimiter({
    ...config,
    prefix: config.prefix || 'ratelimit:user',
  });

  const { success, limit, remaining, reset } = await limiter.limit(userId);

  return {
    success,
    limit,
    remaining,
    reset,
  };
}
