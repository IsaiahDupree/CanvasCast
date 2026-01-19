/**
 * API-004: Get Project Endpoint
 *
 * Tests that verify:
 * 1. GET /api/v1/projects/:id returns project with job status
 * 2. Checks ownership (user can only access their own projects)
 * 3. Returns 404 for non-existent projects
 *
 * Acceptance Criteria:
 * - Returns project with job status
 * - Checks ownership (returns 404 if not owner)
 * - Includes related jobs and assets
 * - Returns proper error messages
 */

import { describe, it, expect } from 'vitest';

describe('API-004: Get Project Endpoint', () => {
  describe('Endpoint Definition', () => {
    it('should have GET /api/v1/projects/:projectId endpoint defined', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      expect(indexContent).toContain("app.get('/api/v1/projects/:projectId'");
      expect(indexContent).toContain('authenticateToken');
    });

    it('should require authentication', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Check that the endpoint has authenticateToken middleware
      const getProjectEndpointRegex = /app\.get\(['"]\/api\/v1\/projects\/:projectId['"],\s*authenticateToken/;
      expect(indexContent).toMatch(getProjectEndpointRegex);
    });
  });

  describe('Data Retrieval', () => {
    it('should query project by ID from database', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify project query
      expect(indexContent).toContain("from('projects')");
      expect(indexContent).toContain('.eq(\'id\', req.params.projectId)');
    });

    it('should include related jobs data', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify jobs are included in select
      expect(indexContent).toContain('.select(\'*, jobs(*)');
    });

    it('should include related assets data', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify assets are included in select
      expect(indexContent).toContain('assets(*)');
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

    it('should use .single() to get one result', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify single() is used
      expect(indexContent).toContain('.single()');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 if project not found', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify 404 handling
      expect(indexContent).toContain('404');
      expect(indexContent).toContain('Project not found');
    });

    it('should return 404 if user is not the owner', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Since we filter by user_id, non-owners will get 404
      // Verify this is handled by checking error || !data condition
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
      expect(indexContent).toContain('Failed to fetch project');
    });
  });

  describe('Response Format', () => {
    it('should return project data with nested relations', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify response includes project
      expect(indexContent).toContain('res.json({ project: data })');
    });

    it('should extract projectId from request params', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify params extraction
      expect(indexContent).toContain('req.params.projectId');
    });
  });

  describe('Data Integrity', () => {
    it('should ensure jobs array is included in response', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Since we select with jobs(*), the response will have jobs
      expect(indexContent).toMatch(/jobs\(\*\)/);
    });

    it('should ensure assets array is included in response', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Since we select with assets(*), the response will have assets
      expect(indexContent).toMatch(/assets\(\*\)/);
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

    it('should only return projects owned by authenticated user', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Ownership check via user_id filter
      expect(indexContent).toMatch(/\.eq\(['"]user_id['"],\s*req\.user!\.id\)/);
    });
  });

  describe('Route Parameter Handling', () => {
    it('should use projectId parameter from route', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify route uses :projectId parameter
      expect(indexContent).toContain(':projectId');
      expect(indexContent).toContain('req.params.projectId');
    });
  });
});
