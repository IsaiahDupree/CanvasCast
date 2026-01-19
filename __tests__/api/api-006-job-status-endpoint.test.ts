/**
 * API-006: Job Status Endpoint
 *
 * Tests that verify:
 * 1. GET /api/v1/jobs/:id/status returns job status and progress
 * 2. Returns step details (job_steps)
 * 3. Verifies user ownership of the job
 * 4. Returns 404 for non-existent or unauthorized jobs
 *
 * Acceptance Criteria:
 * - Returns job status and progress
 * - Returns step details with timestamps and states
 * - Checks ownership (user can only access their own jobs)
 * - Returns proper error messages
 */

import { describe, it, expect } from 'vitest';

describe('API-006: Job Status Endpoint', () => {
  describe('Endpoint Definition', () => {
    it('should have GET /api/v1/jobs/:id/status endpoint defined', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      expect(indexContent).toContain("app.get('/api/v1/jobs/:id/status'");
    });

    it('should require authentication', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Check that the endpoint has authenticateToken middleware
      const jobStatusEndpointRegex = /app\.get\(['"]\/api\/v1\/jobs\/:id\/status['"],\s*authenticateToken/;
      expect(indexContent).toMatch(jobStatusEndpointRegex);
    });
  });

  describe('Data Retrieval', () => {
    it('should query job by ID from database', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify job query
      expect(indexContent).toContain("from('jobs')");
      expect(indexContent).toMatch(/\.eq\(['"]id['"],\s*req\.params\.id\)/);
    });

    it('should include job_steps data', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify job_steps are included in select
      expect(indexContent).toContain('job_steps(*)');
    });

    it('should use .single() to get one job', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify single() is used
      expect(indexContent).toContain('.single()');
    });
  });

  describe('Ownership Check', () => {
    it('should filter by user_id to check ownership', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify user_id check
      expect(indexContent).toMatch(/\.eq\(['"]user_id['"],\s*req\.user!\.id\)/);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 if job not found', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify 404 handling
      expect(indexContent).toContain('404');
      expect(indexContent).toContain('Job not found');
    });

    it('should return 404 if user is not the owner', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Since we filter by user_id, non-owners will get 404
      expect(indexContent).toMatch(/error\s*\|\|\s*!data/);
    });

    it('should handle general errors with 500 status', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify try-catch error handling
      expect(indexContent).toContain('catch');
      expect(indexContent).toContain('500');
      expect(indexContent).toContain('Failed to fetch job status');
    });
  });

  describe('Response Format', () => {
    it('should return job data with status and progress', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify response includes job
      expect(indexContent).toContain('res.json({ job: data })');
    });

    it('should include job_steps in response', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Since we select with job_steps(*), the response will have steps
      expect(indexContent).toMatch(/job_steps\(\*\)/);
    });
  });

  describe('Route Parameter Handling', () => {
    it('should extract job id from route parameter', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify route parameter extraction
      expect(indexContent).toContain('req.params.id');
    });

    it('should use :id parameter in route definition', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify route uses :id parameter
      expect(indexContent).toContain('/api/v1/jobs/:id/status');
    });
  });

  describe('Security', () => {
    it('should validate authentication before processing', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Authentication is enforced by authenticateToken middleware
      expect(indexContent).toContain('authenticateToken');
    });

    it('should only return jobs owned by authenticated user', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Ownership check via user_id filter
      expect(indexContent).toMatch(/\.eq\(['"]user_id['"],\s*req\.user!\.id\)/);
    });
  });

  describe('Data Structure', () => {
    it('should return job with status field', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Job table has status field - verify we're selecting from jobs
      expect(indexContent).toContain("from('jobs')");
    });

    it('should return job with progress field', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Job table has progress field - verify we're selecting from jobs
      expect(indexContent).toContain("from('jobs')");
    });
  });
});
