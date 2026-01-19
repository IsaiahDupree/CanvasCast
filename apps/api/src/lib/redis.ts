/**
 * Redis Client Setup
 *
 * Provides a singleton Redis client instance for the API server.
 * Handles connection lifecycle, error handling, and status monitoring.
 */

import { Redis } from 'ioredis';

let redisClient: Redis | null = null;
let redisConnected = false;

export interface RedisConfig {
  url?: string;
  maxRetriesPerRequest?: number;
  connectTimeout?: number;
  lazyConnect?: boolean;
  enableOfflineQueue?: boolean;
}

/**
 * Creates and returns a singleton Redis client instance.
 * If a client already exists, returns the existing instance.
 *
 * @param config - Optional Redis configuration
 * @returns Redis client instance
 */
export function createRedisClient(config?: RedisConfig): Redis {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = config?.url || process.env.REDIS_URL || 'redis://localhost:6379';

  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: config?.maxRetriesPerRequest ?? 3,
    connectTimeout: config?.connectTimeout ?? 5000,
    lazyConnect: config?.lazyConnect ?? true,
    enableOfflineQueue: config?.enableOfflineQueue ?? false,
  });

  // Event handlers
  redisClient.on('connect', () => {
    console.log('[REDIS] ✅ Connected');
    redisConnected = true;
  });

  redisClient.on('error', (err: Error) => {
    console.error('[REDIS] ❌ Connection error:', err.message);
    redisConnected = false;
  });

  redisClient.on('close', () => {
    console.log('[REDIS] 🔌 Connection closed');
    redisConnected = false;
  });

  // Attempt to connect
  redisClient.connect().catch((err: Error) => {
    console.error('[REDIS] ❌ Initial connection failed:', err.message);
  });

  return redisClient;
}

/**
 * Returns the current Redis client instance without creating a new one.
 *
 * @returns Redis client instance or null if not yet created
 */
export function getRedisClient(): Redis | null {
  return redisClient;
}

/**
 * Returns the connection status of the Redis client.
 *
 * @returns true if connected, false otherwise
 */
export function getRedisStatus(): boolean {
  return redisConnected;
}

/**
 * Closes the Redis connection and resets the singleton.
 * Useful for graceful shutdown and testing.
 */
export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    redisConnected = false;
  }
}
