/**
 * Tests for InMemoryRateLimiter
 *
 * Feature: RATE-001, NOMOCK-001
 */

import { InMemoryRateLimiter } from '../in-memory-ratelimiter';

describe('InMemoryRateLimiter', () => {
  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    limiter = new InMemoryRateLimiter();
  });

  describe('evalsha', () => {
    it('should allow first request within limit', async () => {
      const key = 'test:user:1';
      const limit = 10;
      const windowMs = 60000;

      // Format: evalsha(scriptHash, [keys], [limit, timestamp, windowMs])
      const result = await limiter.evalsha('sha1', [key], [limit, Date.now(), windowMs]);

      expect(result).toHaveLength(3);
      expect(result[0]).toBe(1); // success
      expect(result[1]).toBe(9); // remaining (limit - 1)
      expect(typeof result[2]).toBe('number'); // reset timestamp
    });

    it('should decrement remaining on subsequent requests', async () => {
      const key = 'test:user:2';
      const limit = 5;
      const windowMs = 60000;

      // First request
      const result1 = await limiter.evalsha('sha1', [key], [limit, Date.now(), windowMs]);
      expect(result1[0]).toBe(1);
      expect(result1[1]).toBe(4);

      // Second request
      const result2 = await limiter.evalsha('sha1', [key], [limit, Date.now(), windowMs]);
      expect(result2[0]).toBe(1);
      expect(result2[1]).toBe(3);

      // Third request
      const result3 = await limiter.evalsha('sha1', [key], [limit, Date.now(), windowMs]);
      expect(result3[0]).toBe(1);
      expect(result3[1]).toBe(2);
    });

    it('should reject requests when limit exceeded', async () => {
      const key = 'test:user:3';
      const limit = 3;
      const windowMs = 60000;

      // Use up all requests
      await limiter.evalsha('sha1', [key], [limit, Date.now(), windowMs]);
      await limiter.evalsha('sha1', [key], [limit, Date.now(), windowMs]);
      await limiter.evalsha('sha1', [key], [limit, Date.now(), windowMs]);

      // Fourth request should be rejected
      const result = await limiter.evalsha('sha1', [key], [limit, Date.now(), windowMs]);
      expect(result[0]).toBe(0); // failure
      expect(result[1]).toBe(0); // no remaining
    });

    it('should reset after window expires', async () => {
      const key = 'test:user:4';
      const limit = 2;
      const windowMs = 100; // 100ms window

      // Use up all requests
      await limiter.evalsha('sha1', [key], [limit, Date.now(), windowMs]);
      await limiter.evalsha('sha1', [key], [limit, Date.now(), windowMs]);

      // Third request should be rejected
      const result1 = await limiter.evalsha('sha1', [key], [limit, Date.now(), windowMs]);
      expect(result1[0]).toBe(0);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should allow requests again
      const result2 = await limiter.evalsha('sha1', [key], [limit, Date.now(), windowMs]);
      expect(result2[0]).toBe(1);
      expect(result2[1]).toBe(1); // limit - 1
    });

    it('should handle multiple keys independently', async () => {
      const limit = 2;
      const windowMs = 60000;

      // Request for user 1
      const result1 = await limiter.evalsha('sha1', ['user:1'], [limit, Date.now(), windowMs]);
      expect(result1[0]).toBe(1);
      expect(result1[1]).toBe(1);

      // Request for user 2
      const result2 = await limiter.evalsha('sha1', ['user:2'], [limit, Date.now(), windowMs]);
      expect(result2[0]).toBe(1);
      expect(result2[1]).toBe(1);

      // Another request for user 1
      const result3 = await limiter.evalsha('sha1', ['user:1'], [limit, Date.now(), windowMs]);
      expect(result3[0]).toBe(1);
      expect(result3[1]).toBe(0);

      // User 1 should be rate limited
      const result4 = await limiter.evalsha('sha1', ['user:1'], [limit, Date.now(), windowMs]);
      expect(result4[0]).toBe(0);

      // User 2 should still have capacity
      const result5 = await limiter.evalsha('sha1', ['user:2'], [limit, Date.now(), windowMs]);
      expect(result5[0]).toBe(1);
    });
  });

  describe('del', () => {
    it('should delete a key and return 1 if existed', async () => {
      const key = 'test:user:5';
      const limit = 10;
      const windowMs = 60000;

      // Create an entry
      await limiter.evalsha('sha1', [key], [limit, Date.now(), windowMs]);

      // Delete it
      const result = await limiter.del(key);
      expect(result).toBe(1);
    });

    it('should return 0 if key did not exist', async () => {
      const result = await limiter.del('nonexistent:key');
      expect(result).toBe(0);
    });

    it('should reset the rate limit after deletion', async () => {
      const key = 'test:user:6';
      const limit = 2;
      const windowMs = 60000;

      // Use up all requests
      await limiter.evalsha('sha1', [key], [limit, Date.now(), windowMs]);
      await limiter.evalsha('sha1', [key], [limit, Date.now(), windowMs]);

      // Should be rate limited
      const result1 = await limiter.evalsha('sha1', [key], [limit, Date.now(), windowMs]);
      expect(result1[0]).toBe(0);

      // Delete the key
      await limiter.del(key);

      // Should allow requests again
      const result2 = await limiter.evalsha('sha1', [key], [limit, Date.now(), windowMs]);
      expect(result2[0]).toBe(1);
      expect(result2[1]).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear all entries', async () => {
      const limit = 10;
      const windowMs = 60000;

      // Create multiple entries
      await limiter.evalsha('sha1', ['user:1'], [limit, Date.now(), windowMs]);
      await limiter.evalsha('sha1', ['user:2'], [limit, Date.now(), windowMs]);
      await limiter.evalsha('sha1', ['user:3'], [limit, Date.now(), windowMs]);

      // Clear all
      limiter.clear();

      // All keys should be reset
      const result1 = await limiter.evalsha('sha1', ['user:1'], [limit, Date.now(), windowMs]);
      expect(result1[1]).toBe(9); // Should start fresh

      const result2 = await limiter.evalsha('sha1', ['user:2'], [limit, Date.now(), windowMs]);
      expect(result2[1]).toBe(9);
    });
  });

  describe('edge cases', () => {
    it('should handle default values if args are missing', async () => {
      const result = await limiter.evalsha('sha1');
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(1);
    });

    it('should handle empty arrays in args', async () => {
      const result = await limiter.evalsha('sha1', [], []);
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(1);
    });
  });
});
