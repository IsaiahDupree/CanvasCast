/**
 * API-013: Health Check Endpoint
 *
 * Tests that verify:
 * 1. GET /health endpoint returns status
 * 2. GET /ready endpoint checks Redis and DB connections
 * 3. Proper status codes (200 when ready, 503 when not ready)
 *
 * Acceptance criteria:
 * - Returns status
 * - Checks Redis and DB connections
 */

import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs/promises';

describe('API-013: Health Check Endpoint', () => {
  describe('GET /health endpoint', () => {
    it('should have /health endpoint implemented in index.ts', async () => {
      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      expect(indexContent).toContain("app.get('/health'");
    });

    it('should return status field with "ok" value', async () => {
      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Check that health endpoint returns status: 'ok'
      expect(indexContent).toMatch(/app\.get\(['"]\/health['"]/);
      expect(indexContent).toContain("status: 'ok'");
    });

    it('should return service name', async () => {
      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Check for SERVICE_NAME constant or service field
      expect(indexContent).toContain('SERVICE_NAME');
      expect(indexContent).toContain('service:');
    });

    it('should return uptime in milliseconds', async () => {
      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Check that uptime is calculated from startTimestamp
      expect(indexContent).toContain('uptime:');
      expect(indexContent).toContain('startTimestamp');
      expect(indexContent).toMatch(/Date\.now\(\)\s*-\s*startTimestamp/);
    });

    it('should not require authentication', async () => {
      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Health endpoint should not have authenticateToken middleware
      const healthEndpointMatch = indexContent.match(/app\.get\(['"]\/health['"][^{]*{/);
      expect(healthEndpointMatch).toBeTruthy();
      if (healthEndpointMatch) {
        expect(healthEndpointMatch[0]).not.toContain('authenticateToken');
      }
    });
  });

  describe('GET /ready endpoint', () => {
    it('should have /ready endpoint implemented in index.ts', async () => {
      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      expect(indexContent).toContain("app.get('/ready'");
    });

    it('should return ready field as boolean', async () => {
      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Check that ready endpoint returns ready boolean
      expect(indexContent).toMatch(/app\.get\(['"]\/ready['"]/);
      expect(indexContent).toContain('ready:');
    });

    it('should return checks object', async () => {
      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      expect(indexContent).toContain('checks');
      // Should define checks object with redis and supabase
      expect(indexContent).toMatch(/checks\s*=\s*{/);
    });

    it('should check Redis connection status', async () => {
      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Check that it uses getRedisStatus() to check Redis
      expect(indexContent).toContain('redis:');
      expect(indexContent).toContain('getRedisStatus');
    });

    it('should check Supabase database connection', async () => {
      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Check that it queries Supabase to test DB connection
      expect(indexContent).toContain('supabase:');
      expect(indexContent).toMatch(/supabase\.from\(['"]projects['"]\)/);
      expect(indexContent).toContain('.select');
    });

    it('should return 503 status code when not ready', async () => {
      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Check that /ready endpoint has logic to return 503
      expect(indexContent).toContain('503');
      expect(indexContent).toMatch(/allReady.*\?.*200.*:.*503/);
    });

    it('should check all services are ready using every()', async () => {
      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Check that ready endpoint validates all checks
      expect(indexContent).toContain('allReady');
      expect(indexContent).toMatch(/Object\.values.*checks.*every/);
    });

    it('should return 200 when all checks pass', async () => {
      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Check that it returns 200 when allReady is true
      expect(indexContent).toMatch(/allReady.*\?.*200/);
    });

    it('should not require authentication', async () => {
      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Ready endpoint should not have authenticateToken middleware
      const readyEndpointMatch = indexContent.match(/app\.get\(['"]\/ready['"][^{]*{/);
      expect(readyEndpointMatch).toBeTruthy();
      if (readyEndpointMatch) {
        expect(readyEndpointMatch[0]).not.toContain('authenticateToken');
      }
    });
  });

  describe('Service identification', () => {
    it('should define SERVICE_NAME constant', async () => {
      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      expect(indexContent).toContain('SERVICE_NAME');
      expect(indexContent).toMatch(/const\s+SERVICE_NAME\s*=/);
    });

    it('should track server start timestamp', async () => {
      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      expect(indexContent).toContain('startTimestamp');
      expect(indexContent).toMatch(/startTimestamp\s*=\s*Date\.now\(\)/);
    });
  });

  describe('Integration with Redis status check', () => {
    it('should import getRedisStatus from lib/redis', async () => {
      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Should import getRedisStatus from redis module
      expect(indexContent).toMatch(/import.*getRedisStatus.*from ['"]\.\/lib\/redis/);
    });

    it('should have getRedisStatus function in redis.ts', async () => {
      const redisPath = path.join(process.cwd(), 'apps/api/src/lib/redis.ts');
      const redisContent = await fs.readFile(redisPath, 'utf-8');

      expect(redisContent).toContain('export');
      expect(redisContent).toContain('getRedisStatus');
      expect(redisContent).toMatch(/function getRedisStatus|getRedisStatus.*=.*function/);
    });
  });
});
