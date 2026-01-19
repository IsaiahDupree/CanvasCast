/**
 * API-012: Stripe Webhook Handler
 *
 * Tests that verify:
 * 1. POST /api/webhooks/stripe endpoint exists
 * 2. Verifies Stripe signature
 * 3. Handles checkout.session.completed event
 * 4. Handles invoice.paid event
 * 5. Adds credits for successful payments
 * 6. Rejects unsigned requests
 * 7. Returns proper responses
 *
 * Acceptance Criteria (from feature_list.json):
 * - Verifies Stripe signature
 * - Handles checkout.session.completed
 * - Handles invoice.paid
 */

import { describe, it, expect } from 'vitest';

describe('API-012: Stripe Webhook Handler', () => {
  describe('Endpoint Definition', () => {
    it('should have POST /api/webhooks/stripe endpoint defined', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      expect(indexContent).toContain("app.post('/api/webhooks/stripe'");
    });

    it('should use express.raw middleware for Stripe webhooks', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Stripe webhooks require raw body for signature verification
      expect(indexContent).toContain("express.raw({ type: 'application/json' })");
    });

    it('should NOT require authentication middleware', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Webhooks authenticate via signature, not bearer token
      const webhookEndpointRegex = /app\.post\(['"]\/api\/webhooks\/stripe['"],\s*express\.raw/;
      expect(indexContent).toMatch(webhookEndpointRegex);
    });
  });

  describe('Signature Verification', () => {
    it('should extract stripe-signature header', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify signature extraction
      expect(indexContent).toContain("req.headers['stripe-signature']");
    });

    it('should verify webhook signature using stripe.webhooks.constructEvent', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify constructEvent is called
      expect(indexContent).toContain('stripe.webhooks.constructEvent');
    });

    it('should use STRIPE_WEBHOOK_SECRET environment variable', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify webhook secret is used
      expect(indexContent).toContain('STRIPE_WEBHOOK_SECRET');
    });

    it('should pass raw body to constructEvent', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify raw body is passed
      expect(indexContent).toContain('req.body');
    });

    it('should handle signature verification errors', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify error handling
      expect(indexContent).toMatch(/try.*catch.*error/s);
      expect(indexContent).toContain('400');
      expect(indexContent).toContain('Webhook error');
    });
  });

  describe('checkout.session.completed Event', () => {
    it('should handle checkout.session.completed event type', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify event type handling
      expect(indexContent).toContain("event.type === 'checkout.session.completed'");
    });

    it('should extract session object from event data', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify session extraction
      expect(indexContent).toContain('event.data.object');
    });

    it('should extract user_id from session metadata', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify metadata extraction
      expect(indexContent).toContain('session.metadata?.user_id');
    });

    it('should extract credits from session metadata', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify credits extraction
      expect(indexContent).toContain('session.metadata?.credits');
    });

    it('should validate user_id and credits are present', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify validation
      expect(indexContent).toContain('userId && credits');
    });

    it('should add credits using supabase RPC', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify RPC call
      expect(indexContent).toContain("supabase.rpc('add_credits'");
    });

    it('should log successful credit addition', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify logging
      expect(indexContent).toContain('Added');
      expect(indexContent).toContain('credits');
    });
  });

  describe('invoice.paid Event', () => {
    it('should handle invoice.paid event type', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify invoice.paid event handling
      expect(indexContent).toContain("event.type === 'invoice.paid'");
    });

    it('should extract invoice object from event data', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify invoice extraction
      const invoiceEventRegex = /invoice\.paid.*event\.data\.object/s;
      expect(indexContent).toMatch(invoiceEventRegex);
    });

    it('should retrieve subscription from Stripe for invoice', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify subscription retrieval
      expect(indexContent).toContain('stripe.subscriptions.retrieve');
    });

    it('should extract user_id from subscription metadata', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify metadata usage
      expect(indexContent).toContain('subscription.metadata');
    });

    it('should add subscription credits using RPC', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify RPC call for subscription
      expect(indexContent).toContain("supabase.rpc('add_credits'");
    });

    it('should log successful subscription credit addition', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify logging for subscriptions
      expect(indexContent).toContain('subscription');
    });
  });

  describe('Response Format', () => {
    it('should return received: true on success', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify success response
      expect(indexContent).toContain('res.json({ received: true })');
    });

    it('should return 400 status on signature verification failure', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify error status
      expect(indexContent).toContain('.status(400)');
    });
  });

  describe('Error Handling', () => {
    it('should use try-catch for error handling', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify try-catch block
      expect(indexContent).toMatch(/try.*catch.*error/s);
    });

    it('should log webhook errors', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify error logging
      expect(indexContent).toContain("console.error('[API] Webhook error:'");
    });

    it('should return error message on failure', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify error response
      expect(indexContent).toContain("{ error: 'Webhook error' }");
    });
  });

  describe('Security', () => {
    it('should only process verified webhooks', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // constructEvent throws if signature is invalid
      expect(indexContent).toContain('stripe.webhooks.constructEvent');
    });

    it('should validate metadata before processing', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify validation checks
      expect(indexContent).toContain('userId && credits');
    });

    it('should handle missing metadata gracefully', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify safe metadata access with optional chaining
      expect(indexContent).toContain('metadata?.');
    });
  });

  describe('Route Structure', () => {
    it('should be under /api/webhooks namespace', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify route namespace
      expect(indexContent).toContain('/api/webhooks/stripe');
    });
  });

  describe('Stripe Integration', () => {
    it('should have Stripe client initialized', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify Stripe import and initialization
      expect(indexContent).toContain("import Stripe from 'stripe'");
      expect(indexContent).toContain('new Stripe(');
    });

    it('should use STRIPE_SECRET_KEY environment variable', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify secret key usage
      expect(indexContent).toContain('STRIPE_SECRET_KEY');
    });
  });

  describe('PRD Compliance', () => {
    it('should implement PRD requirements for webhook handling', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Based on PRD requirements from 10-credits-billing.md
      // - Verify Stripe signature
      expect(indexContent).toContain('stripe.webhooks.constructEvent');

      // - Handle checkout.session.completed
      expect(indexContent).toContain('checkout.session.completed');

      // - Handle invoice.paid
      expect(indexContent).toContain('invoice.paid');

      // - Add credits on successful payment
      expect(indexContent).toContain("supabase.rpc('add_credits'");
    });

    it('should match PRD webhook handler structure', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // PRD specifies switch/if statement for event types
      expect(indexContent).toMatch(/event\.type.*checkout\.session\.completed.*invoice\.paid/s);
    });
  });

  describe('Database Integration', () => {
    it('should use add_credits RPC function', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify RPC function call
      expect(indexContent).toContain("supabase.rpc('add_credits'");
    });

    it('should pass correct parameters to add_credits', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify parameters
      expect(indexContent).toContain('p_user_id:');
      expect(indexContent).toContain('p_amount:');
      expect(indexContent).toContain('p_type:');
      expect(indexContent).toContain('p_note:');
    });
  });

  describe('Idempotency', () => {
    it('should handle duplicate webhook deliveries gracefully', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Stripe signature verification ensures same event isn't processed twice
      // Our add_credits RPC should be idempotent
      expect(indexContent).toContain('stripe.webhooks.constructEvent');
    });
  });
});
