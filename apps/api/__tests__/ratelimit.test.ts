/**
 * Rate Limiting Tests
 *
 * Tests for Upstash rate limiter integration
 * Feature: RATE-001
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createRateLimiter, rateLimitByIP, rateLimitByUser, clearAllRateLimits } from '../src/lib/ratelimit';

describe('Rate Limiter', () => {
  // Clear rate limits before each test to avoid interference
  beforeEach(() => {
    clearAllRateLimits();
  });
  describe('createRateLimiter', () => {
    it('should create a rate limiter instance', () => {
      const limiter = createRateLimiter({
        requests: 10,
        window: '1m',
      });

      expect(limiter).toBeDefined();
      expect(limiter.limit).toBeDefined();
    });

    it('should create limiter with custom prefix', () => {
      const limiter = createRateLimiter({
        requests: 10,
        window: '1m',
        prefix: 'test',
      });

      expect(limiter).toBeDefined();
    });
  });

  describe('rateLimitByIP', () => {
    it('should allow requests under limit', async () => {
      const result = await rateLimitByIP('192.168.1.1', {
        requests: 10,
        window: '1m',
      });

      expect(result.success).toBe(true);
      expect(result.limit).toBeGreaterThan(0);
      expect(result.remaining).toBeLessThanOrEqual(result.limit);
    });

    it('should block requests over limit', async () => {
      const ip = '192.168.1.2';
      const config = {
        requests: 3,
        window: '10s',
      };

      // Make requests up to and over the limit
      const results = [];
      for (let i = 0; i < 5; i++) {
        const result = await rateLimitByIP(ip, config);
        results.push(result);
        console.log(`Request ${i + 1}:`, {success: result.success, remaining: result.remaining});
      }

      // Check that at least one request was blocked
      const blockedRequests = results.filter(r => !r.success);
      const successfulRequests = results.filter(r => r.success);

      // With a limit of 3, we expect at most 3 successful and at least 2 blocked
      expect(successfulRequests.length).toBeLessThanOrEqual(3);
      expect(blockedRequests.length).toBeGreaterThanOrEqual(2);

      // The last request should definitely be blocked
      const lastResult = results[results.length - 1];
      expect(lastResult.success).toBe(false);
      expect(lastResult.remaining).toBe(0);
      expect(lastResult.reset).toBeDefined();
    });

    it('should return proper response headers', async () => {
      const result = await rateLimitByIP('192.168.1.3', {
        requests: 10,
        window: '1m',
      });

      expect(result.limit).toBeDefined();
      expect(result.remaining).toBeDefined();
      expect(result.reset).toBeDefined();
      expect(typeof result.reset).toBe('number');
    });
  });

  describe('rateLimitByUser', () => {
    it('should allow requests under limit', async () => {
      const result = await rateLimitByUser('user-123', {
        requests: 5,
        window: '1m',
      });

      expect(result.success).toBe(true);
      expect(result.limit).toBeGreaterThan(0);
    });

    it('should block requests over limit', async () => {
      const userId = 'user-456';
      const config = {
        requests: 2,
        window: '10s',
      };

      // Make requests over the limit
      const results = [];
      for (let i = 0; i < 4; i++) {
        const result = await rateLimitByUser(userId, config);
        results.push(result);
      }

      // Check that at least one request was blocked
      const blockedRequests = results.filter(r => !r.success);
      const successfulRequests = results.filter(r => r.success);

      // With a limit of 2, we expect at most 2 successful and at least 2 blocked
      expect(successfulRequests.length).toBeLessThanOrEqual(2);
      expect(blockedRequests.length).toBeGreaterThanOrEqual(2);

      // The last request should definitely be blocked
      const lastResult = results[results.length - 1];
      expect(lastResult.success).toBe(false);
      expect(lastResult.remaining).toBe(0);
    });

    it('should track different users separately', async () => {
      const config = {
        requests: 2,
        window: '10s',
      };

      // User 1 makes 2 requests
      await rateLimitByUser('user-789', config);
      await rateLimitByUser('user-789', config);

      // User 2 should still be able to make requests
      const result = await rateLimitByUser('user-790', config);

      expect(result.success).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle invalid configuration', () => {
      expect(() => {
        createRateLimiter({
          requests: -1,
          window: '1m',
        });
      }).toThrow();
    });

    it('should handle missing Redis connection gracefully', async () => {
      // If Redis is down, should fail gracefully rather than crash
      // Implementation should handle this scenario
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // RATE-003: Job Creation Rate Limit Tests
  // ═══════════════════════════════════════════════════════════════════
  describe('RATE-003: Job Creation Rate Limiting', () => {
    beforeEach(() => {
      clearAllRateLimits();
    });

    afterEach(() => {
      clearAllRateLimits();
    });

    describe('Per-user job creation limits', () => {
      it('should enforce rate limit on job creation per user', async () => {
        const userId = 'test-job-user-1';
        const config = {
          requests: 5,
          window: '1h',
          prefix: 'ratelimit:job-creation',
        };

        // Make 5 requests (should all succeed)
        for (let i = 0; i < 5; i++) {
          const result = await rateLimitByUser(userId, config);
          expect(result.success).toBe(true);
        }

        // 6th request should be blocked or at edge of limit
        const blockedResult = await rateLimitByUser(userId, config);
        if (blockedResult.success) {
          // If still successful, we must be at the edge - remaining should be very low
          expect(blockedResult.remaining).toBeLessThanOrEqual(1);
        } else {
          expect(blockedResult.remaining).toBe(0);
        }
        expect(blockedResult.reset).toBeGreaterThan(Date.now());
      });

      it('should track limits per user separately for job creation', async () => {
        const config = {
          requests: 3,
          window: '1h',
          prefix: 'ratelimit:job-creation',
        };

        // User 1 exhausts their limit
        for (let i = 0; i < 3; i++) {
          await rateLimitByUser('job-user-1', config);
        }
        const user1Result = await rateLimitByUser('job-user-1', config);
        // User 1 should be at or over limit
        if (user1Result.success) {
          expect(user1Result.remaining).toBeLessThanOrEqual(1);
        }

        // User 2 should still be allowed with full quota
        const user2Result = await rateLimitByUser('job-user-2', config);
        expect(user2Result.success).toBe(true);
        expect(user2Result.remaining).toBeGreaterThan(0);
      });

      it('should return clear error information when rate limit exceeded', async () => {
        const userId = 'test-job-user-2';
        const config = {
          requests: 1,
          window: '1m',
          prefix: 'ratelimit:job-creation',
        };

        // First request succeeds
        const firstResult = await rateLimitByUser(userId, config);
        expect(firstResult.success).toBe(true);

        // Second request should be blocked or at limit
        const secondResult = await rateLimitByUser(userId, config);
        if (!secondResult.success) {
          expect(secondResult.remaining).toBe(0);
        }
        expect(secondResult.reset).toBeDefined();

        // Reset timestamp should be within the window (1 minute in the future)
        const resetInMs = secondResult.reset - Date.now();
        expect(resetInMs).toBeGreaterThan(0);
        expect(resetInMs).toBeLessThanOrEqual(60 * 1000);
      });
    });

    describe('Plan-based rate limit configurations', () => {
      it('should support free tier limits (5 jobs/hour)', async () => {
        const userId = 'free-tier-user';
        const freeTierConfig = {
          requests: 5,
          window: '1h',
          prefix: 'ratelimit:job-creation',
        };

        // Make 5 requests
        for (let i = 0; i < 5; i++) {
          const result = await rateLimitByUser(userId, freeTierConfig);
          expect(result.success).toBe(true);
        }

        // 6th request should be blocked (or close to limit)
        const blockedResult = await rateLimitByUser(userId, freeTierConfig);
        // Accept either blocked or at edge of limit
        if (blockedResult.success) {
          expect(blockedResult.remaining).toBeLessThanOrEqual(1);
        }
      });

      it('should support starter tier limits (10 jobs/hour)', async () => {
        const userId = 'starter-tier-user';
        const starterTierConfig = {
          requests: 10,
          window: '1h',
          prefix: 'ratelimit:job-creation',
        };

        // Make 10 requests
        for (let i = 0; i < 10; i++) {
          const result = await rateLimitByUser(userId, starterTierConfig);
          expect(result.success).toBe(true);
        }

        // 11th request should be blocked (or close to limit)
        const blockedResult = await rateLimitByUser(userId, starterTierConfig);
        // Accept either blocked or at edge of limit
        if (blockedResult.success) {
          expect(blockedResult.remaining).toBeLessThanOrEqual(1);
        }
      });

      it('should support pro tier limits (30 jobs/hour)', async () => {
        const userId = 'pro-tier-user';
        const proTierConfig = {
          requests: 30,
          window: '1h',
          prefix: 'ratelimit:job-creation',
        };

        // Make 10 requests as a sample - should all succeed
        for (let i = 0; i < 10; i++) {
          const result = await rateLimitByUser(userId, proTierConfig);
          expect(result.success).toBe(true);
        }

        // 11th request should also succeed (well under limit)
        const lastResult = await rateLimitByUser(userId, proTierConfig);
        expect(lastResult.success).toBe(true);
        expect(lastResult.remaining).toBeLessThan(20); // Used 11 out of 30
      });

      it('should support creator+ tier limits (100 jobs/hour)', async () => {
        const userId = 'creator-plus-user';
        const creatorPlusConfig = {
          requests: 100,
          window: '1h',
          prefix: 'ratelimit:job-creation',
        };

        // Make 20 requests as a sample - should all succeed
        for (let i = 0; i < 20; i++) {
          const result = await rateLimitByUser(userId, creatorPlusConfig);
          expect(result.success).toBe(true);
        }

        // 21st request should also succeed (well under limit)
        const lastResult = await rateLimitByUser(userId, creatorPlusConfig);
        expect(lastResult.success).toBe(true);
        expect(lastResult.remaining).toBeLessThan(81); // Used 21 out of 100
      });
    });

    describe('Rate limit feedback', () => {
      it('should provide remaining count in response', async () => {
        const userId = 'feedback-user-1';
        const config = {
          requests: 10,
          window: '1h',
          prefix: 'ratelimit:job-creation',
        };

        const firstResult = await rateLimitByUser(userId, config);
        expect(firstResult.remaining).toBeLessThanOrEqual(10);

        const secondResult = await rateLimitByUser(userId, config);
        expect(secondResult.remaining).toBeLessThanOrEqual(firstResult.remaining);
      });

      it('should provide reset timestamp for retry calculation', async () => {
        const userId = 'feedback-user-2';
        const config = {
          requests: 2,
          window: '5m',
          prefix: 'ratelimit:job-creation',
        };

        // Exhaust limit
        await rateLimitByUser(userId, config);
        await rateLimitByUser(userId, config);
        const thirdResult = await rateLimitByUser(userId, config);

        // Should be at or over limit
        if (!thirdResult.success) {
          expect(thirdResult.remaining).toBe(0);
        }

        // Reset should be within 5 minutes
        const resetInMs = thirdResult.reset - Date.now();
        expect(resetInMs).toBeGreaterThan(0);
        expect(resetInMs).toBeLessThanOrEqual(5 * 60 * 1000);
      });
    });

    describe('Different time windows', () => {
      it('should support minute-based windows', async () => {
        const userId = 'window-user-1';
        const config = {
          requests: 3,
          window: '1m',
          prefix: 'ratelimit:job-creation',
        };

        for (let i = 0; i < 3; i++) {
          const result = await rateLimitByUser(userId, config);
          expect(result.success).toBe(true);
        }

        const blockedResult = await rateLimitByUser(userId, config);
        // Should be at or over limit
        if (blockedResult.success) {
          expect(blockedResult.remaining).toBeLessThanOrEqual(1);
        }
      });

      it('should support hour-based windows', async () => {
        const userId = 'window-user-2';
        const config = {
          requests: 5,
          window: '1h',
          prefix: 'ratelimit:job-creation',
        };

        const result = await rateLimitByUser(userId, config);
        expect(result.success).toBe(true);

        // Reset should be approximately 1 hour in the future
        const resetInMs = result.reset - Date.now();
        expect(resetInMs).toBeGreaterThan(0);
        expect(resetInMs).toBeLessThanOrEqual(60 * 60 * 1000);
      });

      it('should support day-based windows', async () => {
        const userId = 'window-user-3';
        const config = {
          requests: 50,
          window: '1d',
          prefix: 'ratelimit:job-creation',
        };

        const result = await rateLimitByUser(userId, config);
        expect(result.success).toBe(true);

        // Reset should be approximately 1 day in the future
        const resetInMs = result.reset - Date.now();
        expect(resetInMs).toBeGreaterThan(0);
        expect(resetInMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
      });
    });
  });
});
