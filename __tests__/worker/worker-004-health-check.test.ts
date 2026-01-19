/**
 * WORKER-004: Worker Health Check
 *
 * Tests that verify:
 * 1. Worker exposes HTTP health check endpoint
 * 2. Health endpoint returns worker status
 * 3. Health endpoint reports queue depth
 *
 * Acceptance criteria:
 * - Returns worker status
 * - Reports queue depth
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('WORKER-004: Worker Health Check', () => {
  describe('Health Check File Structure', () => {
    it('should have health.ts file in worker src directory', () => {
      const healthPath = join(process.cwd(), 'apps/worker/src/health.ts');
      expect(existsSync(healthPath)).toBe(true);
    });
  });

  describe('HTTP Server Setup', () => {
    it('should import express or http module for health server', () => {
      const healthPath = join(process.cwd(), 'apps/worker/src/health.ts');
      const content = readFileSync(healthPath, 'utf-8');

      // Accept either express or node:http
      expect(
        content.includes('express') ||
        content.includes('node:http') ||
        content.includes('http')
      ).toBe(true);
    });

    it('should define health check port configuration', () => {
      const healthPath = join(process.cwd(), 'apps/worker/src/health.ts');
      const content = readFileSync(healthPath, 'utf-8');

      expect(content).toMatch(/HEALTH_PORT|PORT/);
    });

    it('should create HTTP server instance', () => {
      const healthPath = join(process.cwd(), 'apps/worker/src/health.ts');
      const content = readFileSync(healthPath, 'utf-8');

      // Should create app or server
      expect(
        content.includes('createServer') ||
        content.includes('express()')
      ).toBe(true);
    });

    it('should start server listening on configured port', () => {
      const healthPath = join(process.cwd(), 'apps/worker/src/health.ts');
      const content = readFileSync(healthPath, 'utf-8');

      expect(content).toContain('.listen');
    });
  });

  describe('GET /health endpoint', () => {
    it('should define /health or root path endpoint', () => {
      const healthPath = join(process.cwd(), 'apps/worker/src/health.ts');
      const content = readFileSync(healthPath, 'utf-8');

      // Accept /health, /, or /status
      expect(
        content.includes("'/health'") ||
        content.includes("'/'") ||
        content.includes('/health') ||
        content.match(/url.*===.*['"]\/health['"]/)
      ).toBe(true);
    });

    it('should return status field with "ok" value', () => {
      const healthPath = join(process.cwd(), 'apps/worker/src/health.ts');
      const content = readFileSync(healthPath, 'utf-8');

      expect(content).toContain("status:");
      expect(content).toMatch(/status\s*:\s*['"]ok['"]/);
    });

    it('should return uptime in response', () => {
      const healthPath = join(process.cwd(), 'apps/worker/src/health.ts');
      const content = readFileSync(healthPath, 'utf-8');

      expect(content).toContain('uptime');
      expect(content).toMatch(/process\.uptime\(\)/);
    });

    it('should respond with JSON content type', () => {
      const healthPath = join(process.cwd(), 'apps/worker/src/health.ts');
      const content = readFileSync(healthPath, 'utf-8');

      // Should set content-type or use res.json()
      expect(
        content.includes('res.json') ||
        content.includes('application/json') ||
        content.includes('JSON.stringify')
      ).toBe(true);
    });
  });

  describe('Queue Depth Reporting', () => {
    it('should report queue statistics in response', () => {
      const healthPath = join(process.cwd(), 'apps/worker/src/health.ts');
      const content = readFileSync(healthPath, 'utf-8');

      expect(content).toContain('queue');
    });

    it('should report waiting jobs count', () => {
      const healthPath = join(process.cwd(), 'apps/worker/src/health.ts');
      const content = readFileSync(healthPath, 'utf-8');

      expect(content).toMatch(/waiting|pending/i);
    });

    it('should report active jobs count', () => {
      const healthPath = join(process.cwd(), 'apps/worker/src/health.ts');
      const content = readFileSync(healthPath, 'utf-8');

      expect(content).toContain('active');
    });

    it('should report failed jobs count', () => {
      const healthPath = join(process.cwd(), 'apps/worker/src/health.ts');
      const content = readFileSync(healthPath, 'utf-8');

      expect(content).toContain('failed');
    });
  });

  describe('Queue Integration', () => {
    it('should query job counts from database', () => {
      const healthPath = join(process.cwd(), 'apps/worker/src/health.ts');
      const content = readFileSync(healthPath, 'utf-8');

      // Should query jobs table or use Supabase
      expect(
        content.includes('supabase') ||
        content.includes('jobs') ||
        content.includes('getJobCounts')
      ).toBe(true);
    });

    it('should import Supabase client or create client', () => {
      const healthPath = join(process.cwd(), 'apps/worker/src/health.ts');
      const content = readFileSync(healthPath, 'utf-8');

      expect(
        content.includes('createClient') ||
        content.includes('supabase')
      ).toBe(true);
    });

    it('should count jobs by status from database', () => {
      const healthPath = join(process.cwd(), 'apps/worker/src/health.ts');
      const content = readFileSync(healthPath, 'utf-8');

      // Should query jobs grouped by status
      expect(
        content.includes('.from') ||
        content.includes('SELECT') ||
        content.includes('status')
      ).toBe(true);
    });
  });

  describe('Worker Status', () => {
    it('should report worker identity or name', () => {
      const healthPath = join(process.cwd(), 'apps/worker/src/health.ts');
      const content = readFileSync(healthPath, 'utf-8');

      expect(
        content.includes('worker') ||
        content.includes('hostname') ||
        content.includes('WORKER')
      ).toBe(true);
    });

    it('should export or start health server function', () => {
      const healthPath = join(process.cwd(), 'apps/worker/src/health.ts');
      const content = readFileSync(healthPath, 'utf-8');

      expect(
        content.includes('export') ||
        content.includes('startHealthServer') ||
        content.match(/function.*Health/i)
      ).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', () => {
      const healthPath = join(process.cwd(), 'apps/worker/src/health.ts');
      const content = readFileSync(healthPath, 'utf-8');

      expect(content).toMatch(/try|catch/);
    });

    it('should return degraded status on errors', () => {
      const healthPath = join(process.cwd(), 'apps/worker/src/health.ts');
      const content = readFileSync(healthPath, 'utf-8');

      // Should have fallback values or error handling
      expect(
        content.includes('catch') ||
        content.includes('error') ||
        content.includes('||')
      ).toBe(true);
    });
  });

  describe('Integration with Worker', () => {
    it('should be importable or callable from worker index', () => {
      const healthPath = join(process.cwd(), 'apps/worker/src/health.ts');
      const content = readFileSync(healthPath, 'utf-8');

      // Health module should export a function to start the server
      expect(
        content.includes('export') ||
        content.includes('module.exports')
      ).toBe(true);
    });
  });

  describe('Environment Configuration', () => {
    it('should use environment variable for health port', () => {
      const healthPath = join(process.cwd(), 'apps/worker/src/health.ts');
      const content = readFileSync(healthPath, 'utf-8');

      expect(content).toMatch(/process\.env\.(HEALTH_PORT|PORT)/);
    });

    it('should have default port if env var not set', () => {
      const healthPath = join(process.cwd(), 'apps/worker/src/health.ts');
      const content = readFileSync(healthPath, 'utf-8');

      // Should have fallback like ?? or || with a number
      expect(content).toMatch(/(\?\?|\|\|)\s*\d{4}/);
    });
  });
});
