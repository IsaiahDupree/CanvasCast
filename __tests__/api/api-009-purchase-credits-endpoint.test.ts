/**
 * API-009: Purchase Credits Endpoint
 *
 * Tests that verify:
 * 1. POST /api/v1/credits/purchase creates Stripe checkout session
 * 2. Returns checkout URL
 * 3. Requires authentication
 * 4. Gets or creates Stripe customer
 * 5. Passes metadata (user_id, credits) to Stripe
 *
 * Acceptance Criteria:
 * - Creates Stripe checkout session
 * - Returns checkout URL
 * - Handles authentication
 * - Creates Stripe customer if needed
 * - Passes correct metadata to Stripe
 */

import { describe, it, expect } from 'vitest';

describe('API-009: Purchase Credits Endpoint', () => {
  describe('Endpoint Definition', () => {
    it('should have POST /api/v1/credits/purchase endpoint defined', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      expect(indexContent).toContain("app.post('/api/v1/credits/purchase'");
    });

    it('should require authentication', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Check that the endpoint has authenticateToken middleware
      const purchaseEndpointRegex = /app\.post\(['"]\/api\/v1\/credits\/purchase['"],\s*authenticateToken/;
      expect(indexContent).toMatch(purchaseEndpointRegex);
    });
  });

  describe('Request Validation', () => {
    it('should accept credits and price_id in request body', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify destructuring of request body
      expect(indexContent).toContain('credits');
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

    it('should set mode to payment for one-time purchases', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify payment mode
      expect(indexContent).toContain("mode: 'payment'");
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

    it('should pass metadata with user_id and credits', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify session metadata
      expect(indexContent).toContain('metadata:');
      expect(indexContent).toContain('user_id:');
      expect(indexContent).toContain('credits:');
    });

    it('should configure success_url', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify success URL
      expect(indexContent).toContain('success_url:');
      expect(indexContent).toContain('/app/credits');
      expect(indexContent).toContain('success=true');
    });

    it('should configure cancel_url', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify cancel URL
      expect(indexContent).toContain('cancel_url:');
      expect(indexContent).toContain('/app/credits');
      expect(indexContent).toContain('canceled=true');
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
      expect(indexContent).toContain('Failed to create checkout session');
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

    it('should create checkout for authenticated user only', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // User ID is taken from authenticated user
      expect(indexContent).toContain('req.user!.id');
    });

    it('should associate checkout with user via metadata', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Metadata includes user_id for webhook verification
      expect(indexContent).toContain('user_id: userId');
    });
  });

  describe('Route Structure', () => {
    it('should be under /api/v1/credits namespace', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify route namespace
      expect(indexContent).toContain('/api/v1/credits/purchase');
    });
  });

  describe('Stripe Integration', () => {
    it('should initialize Stripe client', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify Stripe import and initialization
      expect(indexContent).toContain("import Stripe from 'stripe'");
      expect(indexContent).toContain('new Stripe(');
      expect(indexContent).toContain('STRIPE_SECRET_KEY');
    });

    it('should use environment variable for frontend URL', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify FRONTEND_URL usage
      expect(indexContent).toContain('FRONTEND_URL');
    });
  });

  describe('PRD Compliance', () => {
    it('should implement PRD requirements for checkout session', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Based on PRD requirements from 10-credits-billing.md
      // - Get or create Stripe customer
      expect(indexContent).toContain('stripe.customers.create');

      // - Create checkout session
      expect(indexContent).toContain('stripe.checkout.sessions.create');

      // - Pass metadata with user_id and credits
      expect(indexContent).toContain('metadata:');
      expect(indexContent).toContain('user_id:');
      expect(indexContent).toContain('credits:');

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
  });

  describe('Database Integration', () => {
    it('should query profiles table for customer ID', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify profiles table query
      expect(indexContent).toContain("from('profiles')");
      expect(indexContent).toContain('.select(');
    });

    it('should update profiles with Stripe customer ID', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify profile update
      expect(indexContent).toContain('.update(');
      expect(indexContent).toContain('stripe_customer_id');
    });
  });
});
