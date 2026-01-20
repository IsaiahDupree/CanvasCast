/**
 * Mock Redis Implementation for Testing
 *
 * Provides an in-memory mock of Redis for rate limiting tests
 */

export class MockRedis {
  private store = new Map<string, { count: number; reset: number }>();

  async get(key: string): Promise<string | null> {
    const data = this.store.get(key);
    return data ? JSON.stringify(data) : null;
  }

  async set(key: string, value: string): Promise<'OK'> {
    this.store.set(key, JSON.parse(value));
    return 'OK';
  }

  async incr(key: string): Promise<number> {
    const data = this.store.get(key) || { count: 0, reset: Date.now() + 60000 };
    data.count += 1;
    this.store.set(key, data);
    return data.count;
  }

  async expire(_key: string, _seconds: number): Promise<boolean> {
    return true;
  }

  async del(key: string): Promise<number> {
    const existed = this.store.has(key);
    this.store.delete(key);
    return existed ? 1 : 0;
  }

  /**
   * Mock evalsha for Upstash Ratelimit
   * This simulates the sliding window rate limiting algorithm
   */
  async evalsha(...args: any[]): Promise<any[]> {
    // Upstash @upstash/ratelimit calls evalsha in a specific format:
    // evalsha(scriptHash, [keys], limit, window, nowTimestamp, ...)
    // We need to extract these parameters correctly

    // console.log('[MOCK evalsha] args:', JSON.stringify(args, null, 2));

    let key = 'default';
    let limit = 10;
    let windowMs = 60000;

    // Format: evalsha(scriptHash, [keys...], [limit, timestamp, window, ...])
    if (args.length >= 3) {
      // args[1] is array of keys
      if (Array.isArray(args[1]) && args[1].length > 0) {
        key = args[1][0];
      }

      // args[2] is array of [limit, timestamp, window, ...]
      if (Array.isArray(args[2]) && args[2].length >= 3) {
        limit = args[2][0];
        // args[2][1] is timestamp
        windowMs = args[2][2];
      }
    }

    const now = Date.now();
    const data = this.store.get(key);

    // Reset window if expired or first request
    if (!data || data.reset < now) {
      const newData = { count: 1, reset: now + windowMs };
      this.store.set(key, newData);
      console.log(`[MOCK] First request for ${key}, limit=${limit}, count=1, remaining=${limit - 1}`);
      // Return [success, remaining, reset_timestamp]
      return [1, limit - 1, newData.reset];
    }

    // Check if within limit
    if (data.count < limit) {
      data.count += 1;
      this.store.set(key, data);
      console.log(`[MOCK] Request for ${key}, count=${data.count}/${limit}, remaining=${limit - data.count}`);
      return [1, limit - data.count, data.reset];
    }

    // Rate limit exceeded
    console.log(`[MOCK] Rate limit exceeded for ${key}, count=${data.count}/${limit}`);
    const result = [0, 0, data.reset];
    console.log(`[MOCK] Returning:`, result, typeof result[0], typeof result[1], typeof result[2]);
    return result;
  }

  clear(): void {
    this.store.clear();
  }
}
