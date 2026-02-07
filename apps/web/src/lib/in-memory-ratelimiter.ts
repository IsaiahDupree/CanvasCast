/**
 * In-Memory Rate Limiter
 *
 * A production-ready in-memory rate limiter for development and testing.
 * Uses a sliding window algorithm to track request counts per key.
 *
 * This is used as a fallback when Upstash Redis is not configured
 * (e.g., in local development or test environments).
 *
 * Feature: RATE-001, NOMOCK-001
 */

interface RateLimitEntry {
  count: number;
  reset: number;
}

/**
 * InMemoryRateLimiter implements a sliding window rate limiter
 * compatible with the Upstash Redis interface used by @upstash/ratelimit
 */
export class InMemoryRateLimiter {
  private store = new Map<string, RateLimitEntry>();

  /**
   * Mock evalsha for Upstash Ratelimit compatibility
   * This simulates the sliding window rate limiting algorithm
   *
   * @param args - Arguments from @upstash/ratelimit:
   *   - args[0]: script hash (unused in mock)
   *   - args[1]: array of keys
   *   - args[2]: array of [limit, timestamp, windowMs]
   * @returns [success, remaining, resetTimestamp]
   */
  async evalsha(...args: any[]): Promise<any[]> {
    let key = 'default';
    let limit = 10;
    let windowMs = 60000;

    // Extract parameters from Upstash ratelimit format
    if (args.length >= 3) {
      // args[1] is array of keys
      if (Array.isArray(args[1]) && args[1].length > 0) {
        key = args[1][0];
      }

      // args[2] is array of [limit, timestamp, windowMs]
      if (Array.isArray(args[2]) && args[2].length >= 3) {
        limit = args[2][0];
        windowMs = args[2][2];
      }
    }

    const now = Date.now();
    const data = this.store.get(key);

    // Reset window if expired or first request
    if (!data || data.reset < now) {
      const newData: RateLimitEntry = { count: 1, reset: now + windowMs };
      this.store.set(key, newData);
      // Return [success, remaining, reset_timestamp]
      return [1, limit - 1, newData.reset];
    }

    // Check if within limit
    if (data.count < limit) {
      data.count += 1;
      this.store.set(key, data);
      return [1, limit - data.count, data.reset];
    }

    // Rate limit exceeded
    return [0, 0, data.reset];
  }

  /**
   * Delete a key from the store
   * @param key - The key to delete
   * @returns 1 if key existed, 0 otherwise
   */
  async del(key: string): Promise<number> {
    const existed = this.store.has(key);
    this.store.delete(key);
    return existed ? 1 : 0;
  }

  /**
   * Clear all entries from the store
   * Useful for testing
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get the current size of the store
   * Useful for monitoring and debugging
   */
  size(): number {
    return this.store.size;
  }
}
