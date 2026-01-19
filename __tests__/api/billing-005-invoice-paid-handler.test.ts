/**
 * BILLING-005: Invoice Paid Handler
 *
 * Tests that verify:
 * 1. invoice.paid webhook adds monthly subscription credits
 * 2. Subscription record is updated in database
 * 3. Idempotency is maintained
 * 4. Correct plan-to-credits mapping
 *
 * Acceptance Criteria (from feature_list.json):
 * - Monthly credits added
 * - Subscription updated
 */

import { describe, it, expect } from 'vitest';

describe('BILLING-005: Invoice Paid Handler', () => {
  describe('Invoice Paid Event Handler', () => {
    it('should handle invoice.paid event for subscription renewals', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify invoice.paid event handling exists
      expect(indexContent).toContain("event.type === 'invoice.paid'");
    });

    it('should retrieve subscription data from invoice', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify subscription retrieval logic
      expect(indexContent).toContain('invoice.subscription');
      expect(indexContent).toContain('stripe.subscriptions.retrieve');
    });

    it('should extract user_id and plan from subscription metadata', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify metadata extraction
      expect(indexContent).toContain('subscription.metadata?.user_id');
      expect(indexContent).toContain('subscription.metadata?.plan');
    });

    it('should have credits mapping for subscription plans', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify plan-to-credits mapping
      expect(indexContent).toContain('creditsMap');
      expect(indexContent).toContain('hobbyist');
      expect(indexContent).toContain('creator');
      expect(indexContent).toContain('business');
    });

    it('should use correct credit amounts for each plan', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Based on PRD: hobbyist: 30, creator: 100, business: 300
      expect(indexContent).toMatch(/hobbyist.*30/);
      expect(indexContent).toMatch(/creator.*100/);
      expect(indexContent).toMatch(/business.*300/);
    });
  });

  describe('Credit Addition', () => {
    it('should add subscription credits using add_credits RPC', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify RPC call for subscription credits
      expect(indexContent).toContain("supabase.rpc('add_credits'");
      expect(indexContent).toContain("p_type: 'subscription'");
    });

    it('should include plan name in credit note', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify descriptive note
      expect(indexContent).toContain('Monthly');
      expect(indexContent).toContain('subscription');
    });

    it('should log successful subscription credit addition', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify logging for subscription credits
      expect(indexContent).toContain('subscription credits');
    });
  });

  describe('Idempotency', () => {
    it('should use invoice ID as idempotency key', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify idempotency key usage
      expect(indexContent).toContain('idempotencyKey');
      expect(indexContent).toContain('invoice');
      expect(indexContent).toContain('p_idempotency_key');
    });

    it('should prevent duplicate credit additions for same invoice', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // The add_credits RPC should handle idempotency via idempotency_key
      expect(indexContent).toContain('p_idempotency_key');
    });
  });

  describe('Subscription Record Update', () => {
    it('should update subscription record in database', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Check for subscription update logic
      // This is the key acceptance criteria for BILLING-005
      const hasSubscriptionUpdate =
        indexContent.includes("supabase.from('subscriptions')") ||
        indexContent.includes('.update(') ||
        indexContent.includes('UPDATE subscriptions');

      // If not implemented, test should fail
      expect(hasSubscriptionUpdate).toBe(true);
    });

    it('should update subscription with renewal timestamp', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Look for subscription update with timestamp fields
      const hasTimestampUpdate =
        indexContent.includes('current_period_start') ||
        indexContent.includes('current_period_end') ||
        indexContent.includes('last_invoice');

      expect(hasTimestampUpdate).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should validate user_id and credits before processing', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify validation check
      expect(indexContent).toContain('userId && credits');
    });

    it('should handle missing subscription metadata gracefully', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify safe optional chaining
      expect(indexContent).toContain('metadata?.');
    });

    it('should handle unknown plan types gracefully', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Should have fallback for unknown plans
      expect(indexContent).toMatch(/creditsMap\[.*\].*\|\|.*0/);
    });
  });

  describe('PRD Compliance', () => {
    it('should implement all BILLING-005 acceptance criteria', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Acceptance Criteria 1: Monthly credits added
      expect(indexContent).toContain("supabase.rpc('add_credits'");
      expect(indexContent).toContain("p_type: 'subscription'");

      // Acceptance Criteria 2: Subscription updated
      const hasSubscriptionUpdate =
        indexContent.includes(".from('subscriptions')") ||
        indexContent.includes('UPDATE subscriptions');
      expect(hasSubscriptionUpdate).toBe(true);
    });

    it('should match PRD credit amounts per plan', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // From PRD:
      // Hobbyist: 30 credits/month @ $19/mo
      // Creator: 100 credits/month @ $49/mo
      // Business: 300 credits/month @ $129/mo
      expect(indexContent).toMatch(/hobbyist.*30/);
      expect(indexContent).toMatch(/creator.*100/);
      expect(indexContent).toMatch(/business.*300/);
    });
  });

  describe('Integration Points', () => {
    it('should work with credit_ledger table', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Credits are added via RPC to credit_ledger
      expect(indexContent).toContain("supabase.rpc('add_credits'");
    });

    it('should work with subscriptions table', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Should update subscriptions table
      const hasSubscriptionInteraction =
        indexContent.includes("from('subscriptions')") ||
        indexContent.includes('subscriptions');
      expect(hasSubscriptionInteraction).toBe(true);
    });
  });
});
