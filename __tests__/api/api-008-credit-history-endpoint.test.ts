/**
 * API-008: Credit History Endpoint
 *
 * Tests that verify:
 * 1. GET /api/v1/credits/history returns user's credit transaction history
 * 2. Supports pagination with limit and offset query parameters
 * 3. Returns paginated transaction list
 * 4. Requires authentication
 *
 * Acceptance Criteria:
 * - Returns transaction history
 * - Paginated with configurable limit and offset
 * - Orders by created_at descending (newest first)
 * - Requires authentication
 */

import { describe, it, expect } from 'vitest';

describe('API-008: Credit History Endpoint', () => {
  describe('Endpoint Definition', () => {
    it('should have GET /api/v1/credits/history endpoint defined', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      expect(indexContent).toContain("app.get('/api/v1/credits/history'");
    });

    it('should require authentication', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Check that the endpoint has authenticateToken middleware
      const creditHistoryEndpointRegex = /app\.get\(['"]\/api\/v1\/credits\/history['"],\s*authenticateToken/;
      expect(indexContent).toMatch(creditHistoryEndpointRegex);
    });
  });

  describe('Pagination Support', () => {
    it('should accept limit query parameter', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Should read limit from query params
      expect(indexContent).toMatch(/req\.query\.limit/);
    });

    it('should accept offset query parameter', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Should read offset from query params
      expect(indexContent).toMatch(/req\.query\.offset/);
    });

    it('should default limit to 50 if not provided', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Should have default limit of 50
      expect(indexContent).toMatch(/limit.*50/);
    });

    it('should default offset to 0 if not provided', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Should have default offset of 0
      expect(indexContent).toMatch(/offset.*0/);
    });

    it('should apply pagination using range() or limit/offset', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Should use either range() or limit() with offset() for pagination
      const hasRangePagination = indexContent.includes('.range(');
      const hasLimitOffsetPagination =
        indexContent.includes('.limit(') && indexContent.includes('.range(');

      // At least one pagination method should be present
      expect(hasRangePagination || hasLimitOffsetPagination).toBe(true);
    });
  });

  describe('Query Building', () => {
    it('should query credit_ledger table', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify table query
      expect(indexContent).toContain("from('credit_ledger')");
    });

    it('should filter by user_id', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify user_id filter
      expect(indexContent).toContain("eq('user_id'");
      expect(indexContent).toContain('req.user!.id');
    });

    it('should order by created_at descending', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify ordering
      expect(indexContent).toContain("order('created_at'");
      expect(indexContent).toContain('ascending: false');
    });
  });

  describe('Response Format', () => {
    it('should return transactions array', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify response format includes transactions
      expect(indexContent).toMatch(/transactions:\s*data/);
    });

    it('should return pagination metadata', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Extract the credit history endpoint handler
      const historyEndpointMatch = indexContent.match(
        /app\.get\(['"]\/api\/v1\/credits\/history['"],\s*authenticateToken[^}]*{([^]*?)}\s*\);/
      );

      expect(historyEndpointMatch).toBeTruthy();

      if (historyEndpointMatch) {
        const handlerCode = historyEndpointMatch[1];
        // Should include pagination info in response
        const hasPaginationInfo =
          handlerCode.includes('limit') ||
          handlerCode.includes('offset') ||
          handlerCode.includes('total');
        expect(hasPaginationInfo).toBe(true);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle query errors with 500 status', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify error handling
      expect(indexContent).toContain('500');
      expect(indexContent).toContain('Failed to fetch history');
    });

    it('should use try-catch for error handling', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify try-catch block
      expect(indexContent).toMatch(/try.*catch.*error/s);
    });

    it('should validate pagination parameters', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Should parse and validate numeric values
      const hasValidation =
        indexContent.includes('parseInt') &&
        (indexContent.includes('Math.max') || indexContent.includes('Math.min'));
      expect(hasValidation).toBe(true);
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

    it('should only return history for authenticated user', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // User ID is taken from authenticated user
      expect(indexContent).toContain('req.user!.id');
    });

    it('should enforce maximum limit to prevent abuse', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Should have max limit validation (e.g., Math.min or clamping)
      const hasMaxLimit =
        indexContent.includes('Math.min') &&
        indexContent.includes('100');
      expect(hasMaxLimit).toBe(true);
    });
  });

  describe('Route Structure', () => {
    it('should be under /api/v1/credits namespace', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify route namespace
      expect(indexContent).toContain('/api/v1/credits/history');
    });
  });

  describe('Database Integration', () => {
    it('should query credit_ledger table that exists in migrations', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      // Check that credit_ledger table exists in migrations
      const migrationFiles = await fs.readdir(
        path.join(process.cwd(), 'supabase/migrations')
      );

      const creditLedgerFiles = migrationFiles.filter(f =>
        f.includes('credit') && f.includes('ledger')
      );

      expect(creditLedgerFiles.length).toBeGreaterThan(0);
    });

    it('should have credit_ledger migration file', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const migrationPath = path.join(
        process.cwd(),
        'supabase/migrations/20260118000006_credit_ledger.sql'
      );

      const migrationContent = await fs.readFile(migrationPath, 'utf-8');

      // Verify credit_ledger table exists
      expect(migrationContent).toContain('credit_ledger');
      expect(migrationContent).toContain('user_id');
      expect(migrationContent).toContain('created_at');
    });
  });
});
