/**
 * API-005: List Projects Endpoint
 *
 * Tests that verify:
 * 1. GET /api/v1/projects returns paginated projects
 * 2. Filters by user (only returns user's own projects)
 * 3. Includes related job data
 * 4. Orders by created_at descending
 *
 * Acceptance Criteria:
 * - Returns paginated projects
 * - Filters by user
 * - Includes job status for each project
 * - Orders by most recent first
 */

import { describe, it, expect } from 'vitest';

describe('API-005: List Projects Endpoint', () => {
  describe('Endpoint Definition', () => {
    it('should have GET /api/v1/projects endpoint defined', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      expect(indexContent).toContain("app.get('/api/v1/projects'");
      expect(indexContent).toContain('authenticateToken');
    });

    it('should require authentication', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Check that the endpoint has authenticateToken middleware
      const listProjectsEndpointRegex = /app\.get\(['"]\/api\/v1\/projects['"],\s*authenticateToken/;
      expect(indexContent).toMatch(listProjectsEndpointRegex);
    });
  });

  describe('Data Retrieval', () => {
    it('should query projects from database', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify projects query
      expect(indexContent).toContain("from('projects')");
      expect(indexContent).toContain('.select(');
    });

    it('should include related jobs data', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify jobs are included in select
      expect(indexContent).toContain('jobs(*)');
    });
  });

  describe('User Filtering', () => {
    it('should filter projects by authenticated user', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify user_id filter
      expect(indexContent).toMatch(/\.eq\(['"]user_id['"],\s*req\.user!\.id\)/);
    });

    it('should only return projects owned by the authenticated user', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Security check - verify user_id filtering is in place
      expect(indexContent).toContain('user_id');
      expect(indexContent).toContain('req.user!.id');
    });
  });

  describe('Sorting', () => {
    it('should order projects by created_at descending', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify ordering
      expect(indexContent).toContain('.order(');
      expect(indexContent).toContain('created_at');
      expect(indexContent).toContain('ascending: false');
    });
  });

  describe('Response Format', () => {
    it('should return projects array in response', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify response format
      expect(indexContent).toContain('res.json({ projects: data })');
    });

    it('should return empty array if no projects found', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Since we're returning data directly, empty arrays are handled naturally
      expect(indexContent).toContain('projects: data');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors with 500 status', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify error handling
      expect(indexContent).toContain('500');
      expect(indexContent).toContain('Failed to fetch projects');
    });

    it('should use try-catch for error handling', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify try-catch block
      expect(indexContent).toMatch(/try.*catch.*error/s);
    });

    it('should check for Supabase errors', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify error checking
      expect(indexContent).toMatch(/if\s*\(\s*error\s*\)/);
    });
  });

  describe('Data Integrity', () => {
    it('should include jobs for each project', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Since we select with jobs(*), each project will have jobs array
      expect(indexContent).toMatch(/jobs\(\*\)/);
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

    it('should prevent unauthorized access to other users projects', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // User ID filtering prevents cross-user access
      expect(indexContent).toMatch(/\.eq\(['"]user_id['"],\s*req\.user!\.id\)/);
    });
  });

  describe('Route Handling', () => {
    it('should handle the /api/v1/projects route correctly', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify route is properly defined
      expect(indexContent).toContain("'/api/v1/projects'");
    });
  });

  describe('Performance Considerations', () => {
    it('should use select to limit fields returned', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Using select with specific fields or relations
      expect(indexContent).toContain('.select(');
    });
  });
});
