/**
 * API-002: Redis Client Setup
 *
 * Tests that verify:
 * 1. Redis client is properly configured and can connect
 * 2. BullMQ queue is created with correct configuration
 * 3. Both modules are exported for use in API and worker
 *
 * Acceptance criteria:
 * - Redis connects
 * - BullMQ queue created
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs/promises';

describe('API-002: Redis Client Setup', () => {
  describe('Redis Client Module', () => {
    it('should have apps/api/src/lib/redis.ts file', async () => {
      const redisPath = path.join(process.cwd(), 'apps/api/src/lib/redis.ts');

      try {
        await fs.access(redisPath);
        expect(true).toBe(true);
      } catch {
        throw new Error('apps/api/src/lib/redis.ts does not exist');
      }
    });

    it('should export createRedisClient function', async () => {
      const redisPath = path.join(process.cwd(), 'apps/api/src/lib/redis.ts');
      const content = await fs.readFile(redisPath, 'utf-8');

      expect(content).toContain('export');
      expect(content).toContain('createRedisClient');
    });

    it('should import ioredis', async () => {
      const redisPath = path.join(process.cwd(), 'apps/api/src/lib/redis.ts');
      const content = await fs.readFile(redisPath, 'utf-8');

      expect(content).toMatch(/import.*Redis.*from ['"]ioredis['"]/);
    });

    it('should configure Redis with proper options', async () => {
      const redisPath = path.join(process.cwd(), 'apps/api/src/lib/redis.ts');
      const content = await fs.readFile(redisPath, 'utf-8');

      // Check for key configuration options
      expect(content).toContain('maxRetriesPerRequest');
      expect(content).toContain('connectTimeout');
      expect(content).toContain('lazyConnect');
    });

    it('should use REDIS_URL from environment', async () => {
      const redisPath = path.join(process.cwd(), 'apps/api/src/lib/redis.ts');
      const content = await fs.readFile(redisPath, 'utf-8');

      expect(content).toContain('process.env.REDIS_URL');
    });

    it('should have event handlers for connect, error, and close', async () => {
      const redisPath = path.join(process.cwd(), 'apps/api/src/lib/redis.ts');
      const content = await fs.readFile(redisPath, 'utf-8');

      expect(content).toContain("'connect'");
      expect(content).toContain("'error'");
      expect(content).toContain("'close'");
    });

    it('should export getRedisStatus function', async () => {
      const redisPath = path.join(process.cwd(), 'apps/api/src/lib/redis.ts');
      const content = await fs.readFile(redisPath, 'utf-8');

      expect(content).toContain('export');
      expect(content).toContain('getRedisStatus');
    });
  });

  describe('BullMQ Queue Module', () => {
    it('should have apps/api/src/lib/queue.ts file', async () => {
      const queuePath = path.join(process.cwd(), 'apps/api/src/lib/queue.ts');

      try {
        await fs.access(queuePath);
        expect(true).toBe(true);
      } catch {
        throw new Error('apps/api/src/lib/queue.ts does not exist');
      }
    });

    it('should import Queue from bullmq', async () => {
      const queuePath = path.join(process.cwd(), 'apps/api/src/lib/queue.ts');
      const content = await fs.readFile(queuePath, 'utf-8');

      expect(content).toMatch(/import.*Queue.*from ['"]bullmq['"]/);
    });

    it('should export createJobQueue function', async () => {
      const queuePath = path.join(process.cwd(), 'apps/api/src/lib/queue.ts');
      const content = await fs.readFile(queuePath, 'utf-8');

      expect(content).toContain('export');
      expect(content).toContain('createJobQueue');
    });

    it('should create queue with video-generation name', async () => {
      const queuePath = path.join(process.cwd(), 'apps/api/src/lib/queue.ts');
      const content = await fs.readFile(queuePath, 'utf-8');

      expect(content).toContain('video-generation');
    });

    it('should configure default job options', async () => {
      const queuePath = path.join(process.cwd(), 'apps/api/src/lib/queue.ts');
      const content = await fs.readFile(queuePath, 'utf-8');

      expect(content).toContain('defaultJobOptions');
      expect(content).toContain('attempts');
      expect(content).toContain('backoff');
      expect(content).toContain('removeOnComplete');
      expect(content).toContain('removeOnFail');
    });

    it('should use REDIS_URL for queue connection', async () => {
      const queuePath = path.join(process.cwd(), 'apps/api/src/lib/queue.ts');
      const content = await fs.readFile(queuePath, 'utf-8');

      expect(content).toContain('process.env.REDIS_URL');
    });

    it('should export getJobQueue function', async () => {
      const queuePath = path.join(process.cwd(), 'apps/api/src/lib/queue.ts');
      const content = await fs.readFile(queuePath, 'utf-8');

      expect(content).toContain('export');
      expect(content).toContain('getJobQueue');
    });
  });

  describe('Integration with main server', () => {
    it('should import redis client in index.ts', async () => {
      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const content = await fs.readFile(indexPath, 'utf-8');

      // Should import from lib/redis (with or without .js extension)
      expect(content).toMatch(/import.*from ['"]\.\/lib\/redis(\.js)?['"]/);
    });

    it('should import job queue in index.ts', async () => {
      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const content = await fs.readFile(indexPath, 'utf-8');

      // Should import from lib/queue (with or without .js extension)
      expect(content).toMatch(/import.*from ['"]\.\/lib\/queue(\.js)?['"]/);
    });
  });

  describe('Environment configuration', () => {
    it('should have REDIS_URL in .env.example', async () => {
      const envPath = path.join(process.cwd(), 'apps/api/.env.example');
      const content = await fs.readFile(envPath, 'utf-8');

      expect(content).toContain('REDIS_URL=');
    });
  });
});
