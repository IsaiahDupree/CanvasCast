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

let redisClient: Redis | null = null;

/**
 * Mock Redis for development/testing when Upstash is not configured
 */
class MockRedis {
  private store = new Map<string, { count: number; reset: number }>();

  async evalsha(...args: any[]): Promise<any[]> {
    let key = 'default';
    let limit = 10;
    let windowMs = 60000;

    if (args.length >= 3) {
      if (Array.isArray(args[1]) && args[1].length > 0) {
        key = args[1][0];
      }

      if (Array.isArray(args[2]) && args[2].length >= 3) {
        limit = args[2][0];
        windowMs = args[2][2];
      }
    }

    const now = Date.now();
    const data = this.store.get(key);

    if (!data || data.reset < now) {
      const newData = { count: 1, reset: now + windowMs };
      this.store.set(key, newData);
      return [1, limit - 1, newData.reset];
    }

    if (data.count < limit) {
      data.count += 1;
      this.store.set(key, data);
      return [1, limit - data.count, data.reset];
    }

    return [0, 0, data.reset];
  }

  async del(key: string): Promise<number> {
    const existed = this.store.has(key);
    this.store.delete(key);
    return existed ? 1 : 0;
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * Get or create Redis client for Upstash
 */
function getUpstashRedis(): Redis {
  if (redisClient) {
    return redisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    // Fallback to mock Redis for development and testing
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      console.warn('[RATELIMIT] ⚠️  UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set, using mock Redis');
      const mockRedis = new MockRedis();
      redisClient = mockRedis as any as Redis;
      return mockRedis as any as Redis;
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
