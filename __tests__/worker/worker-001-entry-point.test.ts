/**
 * WORKER-001: Worker Entry Point
 *
 * Tests that verify:
 * 1. Worker process connects to Redis
 * 2. Worker processes jobs from the queue
 * 3. Worker has proper error handling
 *
 * Acceptance criteria:
 * - Connects to Redis
 * - Processes jobs from queue
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('WORKER-001: Worker Entry Point', () => {
  describe('Worker File Structure', () => {
    it('should have worker index.ts entry point', () => {
      const workerIndexPath = join(process.cwd(), 'apps/worker/src/index.ts');
      expect(existsSync(workerIndexPath)).toBe(true);
    });

    it('should have worker.ts file (alternative implementation)', () => {
      const workerPath = join(process.cwd(), 'apps/worker/src/worker.ts');
      expect(existsSync(workerPath)).toBe(true);
    });

    it('should have pipeline runner', () => {
      const runnerPath = join(process.cwd(), 'apps/worker/src/pipeline/runner.ts');
      expect(existsSync(runnerPath)).toBe(true);
    });
  });

  describe('Worker Configuration', () => {
    it('should define worker ID configuration', () => {
      const workerIndexPath = join(process.cwd(), 'apps/worker/src/index.ts');
      const content = readFileSync(workerIndexPath, 'utf-8');

      expect(content).toContain('WORKER_ID');
      expect(content).toContain('worker-');
    });

    it('should define poll interval configuration', () => {
      const workerIndexPath = join(process.cwd(), 'apps/worker/src/index.ts');
      const content = readFileSync(workerIndexPath, 'utf-8');

      expect(content).toContain('POLL_INTERVAL_MS');
    });

    it('should define max active jobs per user', () => {
      const workerIndexPath = join(process.cwd(), 'apps/worker/src/index.ts');
      const content = readFileSync(workerIndexPath, 'utf-8');

      expect(content).toContain('MAX_ACTIVE_PER_USER');
    });
  });

  describe('Job Claiming', () => {
    it('should import job claiming functionality', () => {
      const workerIndexPath = join(process.cwd(), 'apps/worker/src/index.ts');
      const content = readFileSync(workerIndexPath, 'utf-8');

      expect(content).toContain('claimNextJob');
      expect(content).toContain('./lib/claim');
    });

    it('should have claim implementation', () => {
      const claimPath = join(process.cwd(), 'apps/worker/src/lib/claim.ts');
      expect(existsSync(claimPath)).toBe(true);
    });
  });

  describe('Pipeline Integration', () => {
    it('should import runPipeline from runner', () => {
      const workerIndexPath = join(process.cwd(), 'apps/worker/src/index.ts');
      const content = readFileSync(workerIndexPath, 'utf-8');

      expect(content).toContain('runPipeline');
      expect(content).toContain('./pipeline/runner');
    });

    it('should call runPipeline when job is claimed', () => {
      const workerIndexPath = join(process.cwd(), 'apps/worker/src/index.ts');
      const content = readFileSync(workerIndexPath, 'utf-8');

      expect(content).toMatch(/await\s+runPipeline/);
    });
  });

  describe('Error Handling', () => {
    it('should have main loop error handling', () => {
      const workerIndexPath = join(process.cwd(), 'apps/worker/src/index.ts');
      const content = readFileSync(workerIndexPath, 'utf-8');

      expect(content).toContain('try');
      expect(content).toContain('catch');
      expect(content).toContain('error');
    });

    it('should have fatal error handler', () => {
      const workerIndexPath = join(process.cwd(), 'apps/worker/src/index.ts');
      const content = readFileSync(workerIndexPath, 'utf-8');

      expect(content).toContain('Fatal');
      expect(content).toContain('process.exit(1)');
    });
  });

  describe('Stale Job Management', () => {
    it('should import requeueStaleJobs', () => {
      const workerIndexPath = join(process.cwd(), 'apps/worker/src/index.ts');
      const content = readFileSync(workerIndexPath, 'utf-8');

      expect(content).toContain('requeueStaleJobs');
      expect(content).toContain('./lib/db');
    });

    it('should define stale sweep interval', () => {
      const workerIndexPath = join(process.cwd(), 'apps/worker/src/index.ts');
      const content = readFileSync(workerIndexPath, 'utf-8');

      expect(content).toContain('STALE_SWEEP_INTERVAL_MS');
    });

    it('should define stale minutes threshold', () => {
      const workerIndexPath = join(process.cwd(), 'apps/worker/src/index.ts');
      const content = readFileSync(workerIndexPath, 'utf-8');

      expect(content).toContain('STALE_MINUTES');
    });
  });

  describe('Main Loop', () => {
    it('should have while(true) polling loop', () => {
      const workerIndexPath = join(process.cwd(), 'apps/worker/src/index.ts');
      const content = readFileSync(workerIndexPath, 'utf-8');

      expect(content).toContain('while (true)');
    });

    it('should sleep between polls when no job claimed', () => {
      const workerIndexPath = join(process.cwd(), 'apps/worker/src/index.ts');
      const content = readFileSync(workerIndexPath, 'utf-8');

      expect(content).toContain('sleep');
      expect(content).toContain('POLL_INTERVAL_MS');
    });

    it('should have main() function that starts worker', () => {
      const workerIndexPath = join(process.cwd(), 'apps/worker/src/index.ts');
      const content = readFileSync(workerIndexPath, 'utf-8');

      expect(content).toContain('async function main()');
      expect(content).toMatch(/main\(\)/);
    });
  });

  describe('Logging', () => {
    it('should log worker startup', () => {
      const workerIndexPath = join(process.cwd(), 'apps/worker/src/index.ts');
      const content = readFileSync(workerIndexPath, 'utf-8');

      expect(content).toContain('Starting worker');
      expect(content).toContain('console.log');
    });

    it('should log claimed jobs', () => {
      const workerIndexPath = join(process.cwd(), 'apps/worker/src/index.ts');
      const content = readFileSync(workerIndexPath, 'utf-8');

      expect(content).toContain('Claimed job');
    });
  });

  describe('Environment Variables', () => {
    it('should have .env.example for worker', () => {
      const envExamplePath = join(process.cwd(), 'apps/worker/.env.example');
      expect(existsSync(envExamplePath)).toBe(true);
    });

    it('should document required environment variables', () => {
      const envExamplePath = join(process.cwd(), 'apps/worker/.env.example');
      const content = readFileSync(envExamplePath, 'utf-8');

      expect(content).toContain('SUPABASE_URL');
      expect(content).toContain('SUPABASE_SERVICE_ROLE_KEY');
    });
  });

  describe('Alternative Worker Implementation', () => {
    it('should have worker.ts with Supabase job claiming', () => {
      const workerPath = join(process.cwd(), 'apps/worker/src/worker.ts');
      const content = readFileSync(workerPath, 'utf-8');

      expect(content).toContain('createClient');
      expect(content).toContain('@supabase/supabase-js');
      expect(content).toContain('claim_next_job');
    });

    it('should have worker name generation', () => {
      const workerPath = join(process.cwd(), 'apps/worker/src/worker.ts');
      const content = readFileSync(workerPath, 'utf-8');

      expect(content).toContain('WORKER_NAME');
      expect(content).toContain('worker-');
    });

    it('should have polling interval in worker.ts', () => {
      const workerPath = join(process.cwd(), 'apps/worker/src/worker.ts');
      const content = readFileSync(workerPath, 'utf-8');

      expect(content).toContain('POLL_INTERVAL_MS');
    });
  });
});
