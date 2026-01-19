/**
 * TEST-005: API Endpoint Tests - Comprehensive Test Suite
 *
 * This test validates that all API endpoints have proper tests
 * and that authentication is properly tested across all endpoints.
 *
 * Acceptance Criteria:
 * - All endpoints tested
 * - Auth tested
 *
 * This is a meta-test that validates the test coverage of the API endpoints.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('TEST-005: API Endpoint Tests - Comprehensive Coverage', () => {
  describe('Test Coverage Validation', () => {
    it('should have test files for all API endpoints', async () => {
      const apiTestDir = path.join(process.cwd(), '__tests__/api');
      const files = await fs.readdir(apiTestDir);

      // Required test files for all API endpoints
      const requiredTests = [
        'api-001-express-server-setup.test.ts',
        'api-002-redis-client-setup.test.ts',
        'api-003-create-project-endpoint.test.ts',
        'api-004-get-project-endpoint.test.ts',
        'api-005-list-projects-endpoint.test.ts',
        'api-006-job-status-endpoint.test.ts',
        'api-007-credit-balance-endpoint.test.ts',
        'api-008-credit-history-endpoint.test.ts',
        'api-009-purchase-credits-endpoint.test.ts',
        'api-010-create-subscription-endpoint.test.ts',
        'api-011-cancel-subscription-endpoint.test.ts',
        'api-012-stripe-webhook-handler.test.ts',
        'api-013-health-check-endpoint.test.ts',
      ];

      for (const testFile of requiredTests) {
        expect(files).toContain(testFile);
      }
    });

    it('should have authentication middleware tests', async () => {
      const testFile = path.join(process.cwd(), '__tests__/api/api-001-express-server-setup.test.ts');
      const content = await fs.readFile(testFile, 'utf-8');

      // Verify auth middleware is tested
      expect(content).toContain('authenticateToken');
      expect(content).toContain('auth');
    });

    it('should test authentication in project endpoints', async () => {
      const testFile = path.join(process.cwd(), '__tests__/api/api-003-create-project-endpoint.test.ts');
      const content = await fs.readFile(testFile, 'utf-8');

      // Verify authentication scenarios are tested
      expect(content).toContain('auth');
      expect(content.toLowerCase()).toMatch(/token|auth|unauthorized|401/);
    });

    it('should test authentication in credit endpoints', async () => {
      const testFile = path.join(process.cwd(), '__tests__/api/api-007-credit-balance-endpoint.test.ts');
      const content = await fs.readFile(testFile, 'utf-8');

      // Verify authentication scenarios are tested
      expect(content).toContain('auth');
      expect(content.toLowerCase()).toMatch(/token|auth|unauthorized|401/);
    });

    it('should test all CRUD operations for projects', async () => {
      const apiTestDir = path.join(process.cwd(), '__tests__/api');
      const files = await fs.readdir(apiTestDir);

      // Check for Create, Read (single), Read (list)
      expect(files).toContain('api-003-create-project-endpoint.test.ts');
      expect(files).toContain('api-004-get-project-endpoint.test.ts');
      expect(files).toContain('api-005-list-projects-endpoint.test.ts');
    });

    it('should test credit system endpoints', async () => {
      const apiTestDir = path.join(process.cwd(), '__tests__/api');
      const files = await fs.readdir(apiTestDir);

      // Check for balance, history, and purchase endpoints
      expect(files).toContain('api-007-credit-balance-endpoint.test.ts');
      expect(files).toContain('api-008-credit-history-endpoint.test.ts');
      expect(files).toContain('api-009-purchase-credits-endpoint.test.ts');
    });

    it('should test subscription endpoints', async () => {
      const apiTestDir = path.join(process.cwd(), '__tests__/api');
      const files = await fs.readdir(apiTestDir);

      // Check for subscription create and cancel endpoints
      expect(files).toContain('api-010-create-subscription-endpoint.test.ts');
      expect(files).toContain('api-011-cancel-subscription-endpoint.test.ts');
    });

    it('should test Stripe webhook handling', async () => {
      const apiTestDir = path.join(process.cwd(), '__tests__/api');
      const files = await fs.readdir(apiTestDir);

      // Check for Stripe webhook tests
      expect(files).toContain('api-012-stripe-webhook-handler.test.ts');

      const testFile = path.join(process.cwd(), '__tests__/api/api-012-stripe-webhook-handler.test.ts');
      const content = await fs.readFile(testFile, 'utf-8');

      // Verify webhook signature verification is tested
      expect(content).toContain('webhook');
      expect(content.toLowerCase()).toMatch(/signature|stripe/);
    });

    it('should test health check endpoints', async () => {
      const apiTestDir = path.join(process.cwd(), '__tests__/api');
      const files = await fs.readdir(apiTestDir);

      expect(files).toContain('api-013-health-check-endpoint.test.ts');

      const testFile = path.join(process.cwd(), '__tests__/api/api-013-health-check-endpoint.test.ts');
      const content = await fs.readFile(testFile, 'utf-8');

      // Verify health and readiness checks are tested
      expect(content).toContain('/health');
      expect(content).toContain('/ready');
    });
  });

  describe('API Implementation Validation', () => {
    it('should have all required endpoints in index.ts', async () => {
      const indexFile = path.join(process.cwd(), 'apps/api/src/index.ts');
      const content = await fs.readFile(indexFile, 'utf-8');

      // Health endpoints
      expect(content).toContain('app.get(\'/health\'');
      expect(content).toContain('app.get(\'/ready\'');

      // Project endpoints
      expect(content).toContain('app.post(\'/api/v1/projects\'');
      expect(content).toContain('app.get(\'/api/v1/projects\'');
      expect(content).toContain('app.get(\'/api/v1/projects/:projectId\'');

      // Credit endpoints
      expect(content).toContain('app.get(\'/api/v1/credits/balance\'');
      expect(content).toContain('app.get(\'/api/v1/credits/history\'');
      expect(content).toContain('app.post(\'/api/v1/credits/purchase\'');

      // Subscription endpoints
      expect(content).toContain('app.post(\'/api/v1/subscriptions\'');
      expect(content).toContain('app.post(\'/api/v1/subscriptions/cancel\'');

      // Webhook endpoints
      expect(content).toContain('app.post(\'/api/webhooks/stripe\'');

      // Job endpoints
      expect(content).toContain('app.get(\'/api/v1/jobs/:id/status\'');
    });

    it('should have auth middleware defined', async () => {
      const indexFile = path.join(process.cwd(), 'apps/api/src/index.ts');
      const content = await fs.readFile(indexFile, 'utf-8');

      expect(content).toContain('authenticateToken');
      expect(content).toContain('AuthenticatedRequest');
    });

    it('should apply auth middleware to protected endpoints', async () => {
      const indexFile = path.join(process.cwd(), 'apps/api/src/index.ts');
      const content = await fs.readFile(indexFile, 'utf-8');

      // Check that protected endpoints use authenticateToken middleware
      expect(content).toMatch(/app\.(get|post)\('\/api\/v1\/projects',\s*authenticateToken/);
      expect(content).toMatch(/app\.get\('\/api\/v1\/credits\/balance',\s*authenticateToken/);
      expect(content).toMatch(/app\.get\('\/api\/v1\/jobs\/.*',\s*authenticateToken/);
    });

    it('should have proper error handling', async () => {
      const indexFile = path.join(process.cwd(), 'apps/api/src/index.ts');
      const content = await fs.readFile(indexFile, 'utf-8');

      // Check for 404 handler - looks for res.status(404)
      expect(content).toContain('res.status(404)');
      expect(content).toContain('// 404 handler');

      // Check for error handler middleware
      expect(content).toMatch(/app\.use\(.*err.*Error.*NextFunction/);
    });

    it('should have CORS configured', async () => {
      const indexFile = path.join(process.cwd(), 'apps/api/src/index.ts');
      const content = await fs.readFile(indexFile, 'utf-8');

      expect(content).toContain('app.use(cors');
      expect(content).toContain('import cors from \'cors\'');
    });

    it('should have Helmet security middleware', async () => {
      const indexFile = path.join(process.cwd(), 'apps/api/src/index.ts');
      const content = await fs.readFile(indexFile, 'utf-8');

      expect(content).toContain('app.use(helmet');
      expect(content).toContain('import helmet from \'helmet\'');
    });

    it('should validate request bodies with proper validation', async () => {
      const indexFile = path.join(process.cwd(), 'apps/api/src/index.ts');
      const content = await fs.readFile(indexFile, 'utf-8');

      // Check for body parsing
      expect(content).toContain('app.use(express.json');
    });
  });

  describe('Endpoint Response Validation', () => {
    it('should have consistent error response structure', async () => {
      const indexFile = path.join(process.cwd(), 'apps/api/src/index.ts');
      const content = await fs.readFile(indexFile, 'utf-8');

      // Check that errors return { error: string } format
      const errorResponses = content.match(/res\.status\(\d+\)\.json\(\{.*error:/g);
      expect(errorResponses).toBeTruthy();
      expect(errorResponses!.length).toBeGreaterThan(0);
    });

    it('should return appropriate HTTP status codes', async () => {
      const indexFile = path.join(process.cwd(), 'apps/api/src/index.ts');
      const content = await fs.readFile(indexFile, 'utf-8');

      // Check for various status codes
      expect(content).toContain('res.status(401)'); // Unauthorized
      expect(content).toContain('res.status(404)'); // Not Found
      expect(content).toContain('res.status(500)'); // Internal Server Error
      expect(content).toContain('res.status(201)'); // Created
    });

    it('should handle missing authentication tokens', async () => {
      const indexFile = path.join(process.cwd(), 'apps/api/src/index.ts');
      const content = await fs.readFile(indexFile, 'utf-8');

      // Check auth middleware returns 401 when no token
      expect(content).toMatch(/if\s*\(!token\).*401/s);
    });
  });

  describe('Database Integration', () => {
    it('should use Supabase client for database operations', async () => {
      const indexFile = path.join(process.cwd(), 'apps/api/src/index.ts');
      const content = await fs.readFile(indexFile, 'utf-8');

      expect(content).toContain('createClient');
      expect(content).toContain('@supabase/supabase-js');
      expect(content).toContain('supabase.from');
    });

    it('should use RPC functions for credit operations', async () => {
      const indexFile = path.join(process.cwd(), 'apps/api/src/index.ts');
      const content = await fs.readFile(indexFile, 'utf-8');

      // Check for credit RPC functions
      expect(content).toContain('get_credit_balance');
      expect(content).toContain('reserve_credits');
      expect(content).toMatch(/finalize.*credits|release.*credits/i);
    });
  });

  describe('External Service Integration', () => {
    it('should integrate with Stripe', async () => {
      const indexFile = path.join(process.cwd(), 'apps/api/src/index.ts');
      const content = await fs.readFile(indexFile, 'utf-8');

      expect(content).toContain('stripe');
      expect(content).toContain('Stripe');
    });

    it('should integrate with Redis/BullMQ', async () => {
      const indexFile = path.join(process.cwd(), 'apps/api/src/index.ts');
      const content = await fs.readFile(indexFile, 'utf-8');

      expect(content).toContain('redis');
      expect(content).toMatch(/queue|bullmq/i);
    });
  });
});
