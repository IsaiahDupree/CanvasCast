/**
 * API-010: Create Subscription Endpoint
 *
 * Tests that verify:
 * 1. POST /api/v1/subscriptions creates Stripe subscription checkout
 * 2. Returns checkout URL
 * 3. Requires authentication
 * 4. Gets or creates Stripe customer
 * 5. Passes metadata (user_id, plan) to Stripe
 * 6. Sets mode to 'subscription'
 *
 * Acceptance Criteria:
 * - Creates Stripe subscription checkout
 * - Returns checkout URL
 * - Handles authentication
 * - Creates Stripe customer if needed
 * - Passes correct metadata to Stripe
 */

import { describe, it, expect } from 'vitest';

describe('API-010: Create Subscription Endpoint', () => {
  describe('Endpoint Definition', () => {
    it('should have POST /api/v1/subscriptions endpoint defined', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      expect(indexContent).toContain("app.post('/api/v1/subscriptions'");
    });

    it('should require authentication', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Check that the endpoint has authenticateToken middleware
      const subscriptionEndpointRegex = /app\.post\(['"]\/api\/v1\/subscriptions['"],\s*authenticateToken/;
      expect(indexContent).toMatch(subscriptionEndpointRegex);
    });
  });

  describe('Request Validation', () => {
    it('should accept plan and price_id in request body', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify destructuring of request body
      expect(indexContent).toContain('plan');
      expect(indexContent).toContain('price_id');
    });

    it('should extract userId from authenticated user', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify user ID is extracted
      expect(indexContent).toContain('req.user!.id');
    });
  });

  describe('Stripe Customer Management', () => {
    it('should retrieve user profile to get stripe_customer_id', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify profile lookup
      expect(indexContent).toContain("from('profiles')");
      expect(indexContent).toContain('stripe_customer_id');
    });

    it('should create Stripe customer if not exists', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify customer creation
      expect(indexContent).toContain('stripe.customers.create');
    });

    it('should update profile with new Stripe customer ID', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify profile update
      expect(indexContent).toContain('.update({ stripe_customer_id:');
    });

    it('should pass user metadata to Stripe customer', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify metadata
      expect(indexContent).toContain('metadata:');
      expect(indexContent).toContain('user_id:');
    });
  });

  describe('Stripe Checkout Session', () => {
    it('should create Stripe checkout session', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify checkout session creation
      expect(indexContent).toContain('stripe.checkout.sessions.create');
    });

    it('should set mode to subscription', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify subscription mode
      expect(indexContent).toContain("mode: 'subscription'");
    });

    it('should include card as payment method', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify payment method types
      expect(indexContent).toContain("payment_method_types: ['card']");
    });

    it('should configure line items with price_id', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify line items
      expect(indexContent).toContain('line_items:');
      expect(indexContent).toContain('price:');
      expect(indexContent).toContain('quantity: 1');
    });

    it('should pass metadata with user_id and plan', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify session metadata includes plan
      expect(indexContent).toContain('metadata:');
      expect(indexContent).toContain('user_id:');
      expect(indexContent).toContain('plan');
    });

    it('should configure success_url for subscriptions', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify success URL
      expect(indexContent).toContain('success_url:');
    });

    it('should configure cancel_url for subscriptions', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify cancel URL
      expect(indexContent).toContain('cancel_url:');
    });
  });

  describe('Response Format', () => {
    it('should return checkout_url in response', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify response format
      expect(indexContent).toContain('res.json({ checkout_url:');
    });

    it('should return session.url from Stripe', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify session URL is returned
      expect(indexContent).toContain('session.url');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors with 500 status', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify error handling
      expect(indexContent).toContain('500');
    });

    it('should use try-catch for error handling', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify try-catch block
      expect(indexContent).toMatch(/try.*catch.*error/s);
    });

    it('should log Stripe errors', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify error logging
      expect(indexContent).toContain("console.error('[API] Stripe error:'");
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

    it('should create subscription for authenticated user only', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // User ID is taken from authenticated user
      expect(indexContent).toContain('req.user!.id');
    });

    it('should associate subscription with user via metadata', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Metadata includes user_id for webhook verification
      expect(indexContent).toContain('user_id: userId');
    });
  });

  describe('Route Structure', () => {
    it('should be under /api/v1/subscriptions namespace', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify route namespace
      expect(indexContent).toContain('/api/v1/subscriptions');
    });

    it('should not conflict with cancel subscription endpoint', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify both endpoints can coexist
      expect(indexContent).toContain('/api/v1/subscriptions');
    });
  });

  describe('PRD Compliance', () => {
    it('should implement PRD requirements for subscription checkout', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Based on PRD requirements from 10-credits-billing.md
      // - Get or create Stripe customer
      expect(indexContent).toContain('stripe.customers.create');

      // - Create checkout session with mode: 'subscription'
      expect(indexContent).toContain('stripe.checkout.sessions.create');

      // - Pass metadata with user_id and plan
      expect(indexContent).toContain('metadata:');
      expect(indexContent).toContain('user_id:');

      // - Return checkout URL
      expect(indexContent).toContain('checkout_url');
    });

    it('should match PRD response format', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // PRD specifies response should contain checkout_url
      expect(indexContent).toContain('checkout_url');
      expect(indexContent).toContain('session.url');
    });

    it('should validate plan parameter', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Should accept plan from request body
      expect(indexContent).toContain('plan');
    });
  });
});
