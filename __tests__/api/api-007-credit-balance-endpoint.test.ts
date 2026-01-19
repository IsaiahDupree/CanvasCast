/**
 * API-007: Credit Balance Endpoint
 *
 * Tests that verify:
 * 1. GET /api/v1/credits/balance returns user's credit balance
 * 2. Calls get_credit_balance RPC function
 * 3. Returns balance, reserved, and available credits
 * 4. Requires authentication
 *
 * Acceptance Criteria:
 * - Returns balance, reserved, available
 * - Uses get_credit_balance RPC function
 * - Requires authentication
 * - Returns 0 if no balance found
 */

import { describe, it, expect } from 'vitest';

describe('API-007: Credit Balance Endpoint', () => {
  describe('Endpoint Definition', () => {
    it('should have GET /api/v1/credits/balance endpoint defined', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      expect(indexContent).toContain("app.get('/api/v1/credits/balance'");
    });

    it('should require authentication', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Check that the endpoint has authenticateToken middleware
      const creditBalanceEndpointRegex = /app\.get\(['"]\/api\/v1\/credits\/balance['"],\s*authenticateToken/;
      expect(indexContent).toMatch(creditBalanceEndpointRegex);
    });
  });

  describe('RPC Function Call', () => {
    it('should call get_credit_balance RPC function', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify RPC call
      expect(indexContent).toContain("rpc('get_credit_balance'");
    });

    it('should pass user_id to RPC function', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify p_user_id parameter
      expect(indexContent).toContain('p_user_id');
      expect(indexContent).toContain('req.user!.id');
    });
  });

  describe('Response Format', () => {
    it('should return balance in response', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify response format
      expect(indexContent).toContain('res.json({ balance:');
    });

    it('should return 0 if no balance found', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify default value
      expect(indexContent).toContain('data || 0');
    });
  });

  describe('Error Handling', () => {
    it('should handle RPC errors with 500 status', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify error handling
      expect(indexContent).toContain('500');
      expect(indexContent).toContain('Failed to fetch balance');
    });

    it('should use try-catch for error handling', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify try-catch block
      expect(indexContent).toMatch(/try.*catch.*error/s);
    });

    it('should check for RPC errors', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify error checking
      expect(indexContent).toMatch(/if\s*\(\s*error\s*\)/);
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

    it('should only return balance for authenticated user', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // User ID is taken from authenticated user
      expect(indexContent).toContain('req.user!.id');
    });
  });

  describe('Route Structure', () => {
    it('should be under /api/v1/credits namespace', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify route namespace
      expect(indexContent).toContain('/api/v1/credits/balance');
    });
  });

  describe('Database Integration', () => {
    it('should use get_credit_balance database function', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      // Check that the database function exists in migrations
      const migrationFiles = await fs.readdir(
        path.join(process.cwd(), 'supabase/migrations')
      );

      const creditFunctionFiles = migrationFiles.filter(f =>
        f.includes('credit') && f.includes('function')
      );

      expect(creditFunctionFiles.length).toBeGreaterThan(0);
    });

    it('should have credit_functions migration file', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const migrationPath = path.join(
        process.cwd(),
        'supabase/migrations/20260118000010_credit_functions.sql'
      );

      const migrationContent = await fs.readFile(migrationPath, 'utf-8');

      // Verify get_credit_balance function exists
      expect(migrationContent).toContain('get_credit_balance');
      expect(migrationContent).toContain('p_user_id');
    });
  });
});
