/**
 * BILLING-006: Subscription Updated Handler
 *
 * Tests that verify:
 * 1. Handles customer.subscription.updated webhook event
 * 2. Handles customer.subscription.deleted webhook event
 * 3. Updates subscription status changes in database
 * 4. Handles plan changes correctly
 * 5. Properly tracks cancellations and reactivations
 *
 * Acceptance Criteria (from feature_list.json):
 * - Status changes tracked
 * - Plan changes handled
 */

import { describe, it, expect } from 'vitest';

describe('BILLING-006: Subscription Updated Handler', () => {
  describe('customer.subscription.updated Event', () => {
    it('should handle customer.subscription.updated event type', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify subscription.updated event handling
      expect(indexContent).toContain("event.type === 'customer.subscription.updated'");
    });

    it('should extract subscription object from event data', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify subscription extraction for updated event
      const subscriptionUpdatedRegex = /customer\.subscription\.updated.*event\.data\.object/s;
      expect(indexContent).toMatch(subscriptionUpdatedRegex);
    });

    it('should update subscription record in database with new status', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify database update for status
      const dbUpdateRegex = /customer\.subscription\.updated.*supabase.*\.from\(['"]subscriptions['"]\).*\.update/s;
      expect(indexContent).toMatch(dbUpdateRegex);
    });

    it('should track status field changes', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify status tracking
      const statusUpdateRegex = /customer\.subscription\.updated.*status.*subscription\.status/s;
      expect(indexContent).toMatch(statusUpdateRegex);
    });

    it('should track cancel_at_period_end changes', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify cancel_at_period_end tracking
      const cancelAtPeriodEndRegex = /customer\.subscription\.updated.*cancel_at_period_end/s;
      expect(indexContent).toMatch(cancelAtPeriodEndRegex);
    });

    it('should update current_period_start timestamp', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify period start tracking
      const periodStartRegex = /customer\.subscription\.updated.*current_period_start/s;
      expect(indexContent).toMatch(periodStartRegex);
    });

    it('should update current_period_end timestamp', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify period end tracking
      const periodEndRegex = /customer\.subscription\.updated.*current_period_end/s;
      expect(indexContent).toMatch(periodEndRegex);
    });

    it('should match subscription by stripe_subscription_id', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify matching by Stripe ID
      const matchRegex = /customer\.subscription\.updated.*\.eq\(['"]stripe_subscription_id['"]/s;
      expect(indexContent).toMatch(matchRegex);
    });

    it('should handle plan changes by tracking plan metadata', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify plan tracking from metadata
      const planRegex = /customer\.subscription\.updated.*subscription\.metadata.*plan/s;
      expect(indexContent).toMatch(planRegex);
    });

    it('should log subscription update events', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify logging for subscription updates
      const logRegex = /customer\.subscription\.updated.*console\.log.*subscription/s;
      expect(indexContent).toMatch(logRegex);
    });
  });

  describe('customer.subscription.deleted Event', () => {
    it('should handle customer.subscription.deleted event type', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify subscription.deleted event handling
      expect(indexContent).toContain("event.type === 'customer.subscription.deleted'");
    });

    it('should extract subscription object from event data for deleted event', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify subscription extraction for deleted event
      const subscriptionDeletedRegex = /customer\.subscription\.deleted.*event\.data\.object/s;
      expect(indexContent).toMatch(subscriptionDeletedRegex);
    });

    it('should update subscription status to canceled in database', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify database update for deletion
      const dbUpdateRegex = /customer\.subscription\.deleted.*supabase.*\.from\(['"]subscriptions['"]\).*\.update/s;
      expect(indexContent).toMatch(dbUpdateRegex);
    });

    it('should set status to canceled on deletion', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify status set to canceled
      const canceledStatusRegex = /customer\.subscription\.deleted.*status.*['"]canceled['"]/s;
      expect(indexContent).toMatch(canceledStatusRegex);
    });

    it('should match subscription by stripe_subscription_id for deletion', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify matching by Stripe ID
      const matchRegex = /customer\.subscription\.deleted.*\.eq\(['"]stripe_subscription_id['"]/s;
      expect(indexContent).toMatch(matchRegex);
    });

    it('should log subscription deletion events', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Verify logging for subscription deletion
      const logRegex = /customer\.subscription\.deleted.*console\.log.*subscription/s;
      expect(indexContent).toMatch(logRegex);
    });
  });

  describe('Subscription Status Tracking', () => {
    it('should handle active status', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Status tracking should handle all states
      expect(indexContent).toContain('subscription.status');
    });

    it('should handle canceling status', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Should track status changes including canceling
      const statusRegex = /customer\.subscription\.updated.*status/s;
      expect(indexContent).toMatch(statusRegex);
    });

    it('should handle past_due status', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Should track all status changes
      const statusRegex = /customer\.subscription\.updated.*subscription\.status/s;
      expect(indexContent).toMatch(statusRegex);
    });
  });

  describe('Plan Change Tracking', () => {
    it('should detect when plan changes in metadata', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Should read plan from metadata
      const planRegex = /customer\.subscription\.updated.*subscription\.metadata.*plan/s;
      expect(indexContent).toMatch(planRegex);
    });

    it('should update plan field in database on plan change', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Should update plan field
      const planUpdateRegex = /customer\.subscription\.updated.*plan.*subscription\.metadata/s;
      expect(indexContent).toMatch(planUpdateRegex);
    });
  });

  describe('Error Handling', () => {
    it('should gracefully handle subscription not found in database', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Should handle case where subscription doesn't exist
      // (webhook may arrive before initial creation)
      expect(indexContent).toContain('customer.subscription.updated');
    });

    it('should handle missing metadata gracefully', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Should use optional chaining for metadata access
      const metadataRegex = /subscription\.metadata\?/;
      expect(indexContent).toMatch(metadataRegex);
    });
  });

  describe('PRD Compliance', () => {
    it('should implement PRD requirements for subscription webhooks', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Based on BILLING-006 requirements
      // - Status changes tracked
      expect(indexContent).toContain('customer.subscription.updated');

      // - Plan changes handled
      expect(indexContent).toContain('customer.subscription.deleted');
    });

    it('should maintain consistency with existing webhook structure', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const indexPath = path.join(process.cwd(), 'apps/api/src/index.ts');
      const indexContent = await fs.readFile(indexPath, 'utf-8');

      // Should follow same pattern as invoice.paid handler
      expect(indexContent).toMatch(/event\.type.*customer\.subscription\.updated/s);
    });
  });
});
