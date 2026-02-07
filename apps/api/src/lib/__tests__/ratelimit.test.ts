/**
 * Rate Limiting Integration Tests with Real Upstash Redis
 * Feature: NOMOCK-002
 *
 * Tests verify rate limiting works correctly with real Upstash Redis,
 * not just the in-memory fallback.
 *
 * Acceptance Criteria:
 * - Tests verify rate limit counting with real Redis
 * - Tests verify rate limit reset timing
 * - Tests verify sliding window behavior
 * - Tests skip gracefully when UPSTASH_REDIS_REST_URL not available
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import { createRateLimiter, rateLimitByIP, rateLimitByUser } from '../ratelimit';
import { Redis } from '@upstash/redis';

// Check if Upstash is configured
const isUpstashConfigured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

// Helper to wait for a specific duration
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to generate unique keys for each test
const generateTestKey = (prefix: string = 'test') => `${prefix}:${Date.now()}:${Math.random()}`;

describe('NOMOCK-002: Real Upstash Redis Rate Limiting Integration Tests', () => {
  // Skip all tests if Upstash is not configured
  const describeOrSkip = isUpstashConfigured ? describe : describe.skip;

  describeOrSkip('Real Redis Integration', () => {
    let redis: Redis;

    beforeAll(() => {
      if (isUpstashConfigured) {
        redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL!,
          token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        });
      }
    });

    describe('Rate limit counting with real Redis', () => {
      it('should accurately track request counts in Redis', async () => {
        const testIp = generateTestKey('ip');
        const config = {
          requests: 5,
          window: '10s',
          prefix: 'test-count',
        };

        // Make 5 requests
        const results = [];
        for (let i = 0; i < 5; i++) {
          const result = await rateLimitByIP(testIp, config);
          results.push(result);
        }

        // All 5 should succeed
        expect(results.filter((r) => r.success).length).toBe(5);

        // Check remaining count decreases correctly
        expect(results[0].remaining).toBe(4); // First request: 5 - 1 = 4 remaining
        expect(results[1].remaining).toBe(3); // Second request: 5 - 2 = 3 remaining
        expect(results[2].remaining).toBe(2);
        expect(results[3].remaining).toBe(1);
        expect(results[4].remaining).toBe(0); // Fifth request: 5 - 5 = 0 remaining

        // 6th request should be blocked
        const blockedResult = await rateLimitByIP(testIp, config);
        expect(blockedResult.success).toBe(false);
        expect(blockedResult.remaining).toBe(0);
      }, 15000); // Increase timeout for network requests

      it('should track different IPs separately in Redis', async () => {
        const ip1 = generateTestKey('ip1');
        const ip2 = generateTestKey('ip2');
        const config = {
          requests: 3,
          window: '10s',
          prefix: 'test-separate',
        };

        // IP1 exhausts limit
        await rateLimitByIP(ip1, config);
        await rateLimitByIP(ip1, config);
        await rateLimitByIP(ip1, config);
        const ip1Blocked = await rateLimitByIP(ip1, config);
        expect(ip1Blocked.success).toBe(false);

        // IP2 should still have full quota
        const ip2Result = await rateLimitByIP(ip2, config);
        expect(ip2Result.success).toBe(true);
        expect(ip2Result.remaining).toBe(2); // First request, 3 - 1 = 2 remaining
      }, 15000);

      it('should track different users separately in Redis', async () => {
        const user1 = generateTestKey('user1');
        const user2 = generateTestKey('user2');
        const config = {
          requests: 2,
          window: '10s',
          prefix: 'test-user-separate',
        };

        // User1 exhausts limit
        await rateLimitByUser(user1, config);
        await rateLimitByUser(user1, config);
        const user1Blocked = await rateLimitByUser(user1, config);
        expect(user1Blocked.success).toBe(false);

        // User2 should still have full quota
        const user2Result = await rateLimitByUser(user2, config);
        expect(user2Result.success).toBe(true);
        expect(user2Result.remaining).toBe(1);
      }, 15000);
    });

    describe('Rate limit reset timing with real Redis', () => {
      it('should reset rate limit after window expires', async () => {
        const testIp = generateTestKey('ip-reset');
        const config = {
          requests: 2,
          window: '3s', // Short window for testing
          prefix: 'test-reset',
        };

        // Exhaust limit
        await rateLimitByIP(testIp, config);
        await rateLimitByIP(testIp, config);
        const blockedResult = await rateLimitByIP(testIp, config);
        expect(blockedResult.success).toBe(false);

        // Wait for window to expire
        await wait(3500); // Wait 3.5 seconds (longer than 3s window)

        // Should be allowed again
        const afterResetResult = await rateLimitByIP(testIp, config);
        expect(afterResetResult.success).toBe(true);
        expect(afterResetResult.remaining).toBe(1); // First request in new window
      }, 10000);

      it('should provide accurate reset timestamp', async () => {
        const testIp = generateTestKey('ip-timestamp');
        const config = {
          requests: 1,
          window: '5s',
          prefix: 'test-timestamp',
        };

        const startTime = Date.now();
        const result = await rateLimitByIP(testIp, config);

        // Reset should be approximately 5 seconds in the future
        const resetInMs = result.reset - startTime;
        expect(resetInMs).toBeGreaterThan(4000); // At least 4 seconds
        expect(resetInMs).toBeLessThanOrEqual(5500); // At most 5.5 seconds (with tolerance)
      }, 10000);
    });

    describe('Sliding window behavior with real Redis', () => {
      it('should use sliding window algorithm, not fixed window', async () => {
        const testIp = generateTestKey('ip-sliding');
        const config = {
          requests: 3,
          window: '5s',
          prefix: 'test-sliding',
        };

        // Make 3 requests at t=0
        await rateLimitByIP(testIp, config);
        await rateLimitByIP(testIp, config);
        await rateLimitByIP(testIp, config);

        // 4th request should be blocked
        const blocked1 = await rateLimitByIP(testIp, config);
        expect(blocked1.success).toBe(false);

        // Wait 2.5 seconds (half the window)
        await wait(2500);

        // With sliding window, we should still be blocked
        // (all 3 requests are still within the 5s window)
        const blocked2 = await rateLimitByIP(testIp, config);
        expect(blocked2.success).toBe(false);

        // Wait another 3 seconds (total 5.5s from start)
        await wait(3000);

        // Now the first requests should have expired from the window
        const allowed = await rateLimitByIP(testIp, config);
        expect(allowed.success).toBe(true);
      }, 15000);

      it('should allow gradual requests to pass with sliding window', async () => {
        const testIp = generateTestKey('ip-gradual');
        const config = {
          requests: 3,
          window: '6s',
          prefix: 'test-gradual',
        };

        // Make requests with 2-second gaps
        const result1 = await rateLimitByIP(testIp, config);
        expect(result1.success).toBe(true);

        await wait(2000);
        const result2 = await rateLimitByIP(testIp, config);
        expect(result2.success).toBe(true);

        await wait(2000);
        const result3 = await rateLimitByIP(testIp, config);
        expect(result3.success).toBe(true);

        await wait(2000);
        // At this point, the first request (from 6s ago) should have expired
        const result4 = await rateLimitByIP(testIp, config);
        expect(result4.success).toBe(true);
      }, 15000);
    });

    describe('Redis connection verification', () => {
      it('should successfully connect to Upstash Redis', async () => {
        expect(redis).toBeDefined();

        // Try a simple ping
        const testKey = generateTestKey('ping');
        await redis.set(testKey, 'test');
        const value = await redis.get(testKey);
        expect(value).toBe('test');

        // Cleanup
        await redis.del(testKey);
      }, 10000);
    });
  });

  describe('Graceful skip when Upstash not configured', () => {
    it('should skip integration tests when UPSTASH_REDIS_REST_URL is not set', () => {
      if (!isUpstashConfigured) {
        console.log(
          '[NOMOCK-002] ⚠️  Skipping Upstash integration tests - UPSTASH_REDIS_REST_URL not configured'
        );
        expect(isUpstashConfigured).toBe(false);
      } else {
        console.log('[NOMOCK-002] ✅ Running Upstash integration tests');
        expect(isUpstashConfigured).toBe(true);
      }
    });
  });
});
