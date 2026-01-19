/**
 * Credits Page Tests - UI-006
 *
 * This test file validates the Credits Page requirements:
 * 1. Shows current credit balance
 * 2. Purchase options (credit packs and subscriptions)
 * 3. Transaction history
 *
 * Acceptance Criteria:
 * - Shows balance
 * - Purchase options
 * - Transaction history
 *
 * Note: These are integration tests that verify the component structure exists
 * rather than full behavioral tests due to Next.js App Router complexity.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const PAGE_PATH = join(__dirname, '../../apps/web/src/app/app/credits/page.tsx');

describe('UI-006: Credits Page', () => {
  let pageContent: string;

  beforeAll(() => {
    pageContent = readFileSync(PAGE_PATH, 'utf-8');
  });

  describe('Acceptance Criteria: Shows balance', () => {
    it('should display "Your Credits" heading', () => {
      expect(pageContent).toContain('Your Credits');
    });

    it('should display credit balance with credits state', () => {
      expect(pageContent).toMatch(/\[credits.*setCredits\].*useState/);
      expect(pageContent).toMatch(/{credits}/);
    });

    it('should show "minutes available" text', () => {
      expect(pageContent).toContain('minutes available');
    });

    it('should explain credit-to-video mapping', () => {
      expect(pageContent).toMatch(/1 credit = 1 minute of video/);
    });

    it('should fetch credit balance from Supabase RPC', () => {
      expect(pageContent).toMatch(/supabase\.rpc.*get_credit_balance/);
      expect(pageContent).toMatch(/p_user_id/);
    });

    it('should have loading state for credits', () => {
      expect(pageContent).toMatch(/\[loading.*setLoading\].*useState/);
      expect(pageContent).toMatch(/if.*loading/);
      expect(pageContent).toContain('Loader2');
    });

    it('should fetch subscription tier from profiles table', () => {
      expect(pageContent).toMatch(/from\(["']profiles["']\)/);
      expect(pageContent).toMatch(/subscription_tier/);
    });
  });

  describe('Acceptance Criteria: Purchase options', () => {
    it('should display "Monthly Plans" section', () => {
      expect(pageContent).toContain('Monthly Plans');
    });

    it('should display "Top-Up Packs" section', () => {
      expect(pageContent).toContain('Top-Up Packs');
    });

    it('should import PRICING_TIERS from shared package', () => {
      expect(pageContent).toMatch(/import.*PRICING_TIERS.*from.*@canvascast\/shared/);
    });

    it('should import CREDIT_PACKS from shared package', () => {
      expect(pageContent).toMatch(/import.*CREDIT_PACKS.*from.*@canvascast\/shared/);
    });

    it('should map over pricing tiers to display subscription options', () => {
      expect(pageContent).toMatch(/PRICING_TIERS\.map/);
      expect(pageContent).toMatch(/tier\.name/);
      expect(pageContent).toMatch(/tier\.price/);
      expect(pageContent).toMatch(/tier\.credits/);
    });

    it('should map over credit packs to display one-time purchase options', () => {
      expect(pageContent).toMatch(/CREDIT_PACKS\.map/);
      expect(pageContent).toMatch(/pack\.credits/);
      expect(pageContent).toMatch(/pack\.price/);
    });

    it('should display "Subscribe" buttons for subscription tiers', () => {
      expect(pageContent).toContain('Subscribe');
    });

    it('should display "Buy" buttons for credit packs', () => {
      expect(pageContent).toContain('Buy');
    });

    it('should have handlePurchase function', () => {
      expect(pageContent).toMatch(/function handlePurchase|const handlePurchase/);
      expect(pageContent).toMatch(/handlePurchase/);
    });

    it('should call Stripe checkout API', () => {
      expect(pageContent).toMatch(/fetch.*\/api\/stripe\/checkout/);
      expect(pageContent).toMatch(/priceId/);
      expect(pageContent).toMatch(/mode.*subscription.*payment/);
    });

    it('should show "Popular" badge for popular tier', () => {
      expect(pageContent).toMatch(/popular/i);
      expect(pageContent).toContain('Popular');
    });

    it('should display tier icons', () => {
      expect(pageContent).toMatch(/Zap|Crown|Rocket/);
      expect(pageContent).toMatch(/TIER_ICONS/);
    });

    it('should show per-credit pricing for credit packs', () => {
      expect(pageContent).toMatch(/perCredit/);
      expect(pageContent).toMatch(/toFixed/);
    });

    it('should have purchasing state to disable buttons during purchase', () => {
      expect(pageContent).toMatch(/\[purchasing.*setPurchasing\].*useState/);
      expect(pageContent).toMatch(/disabled.*purchasing/);
    });
  });

  describe('Subscription Management', () => {
    it('should show active subscription tier when user has subscription', () => {
      expect(pageContent).toMatch(/Active subscription/i);
      expect(pageContent).toMatch(/subscriptionTier/);
    });

    it('should show "Current Plan" for active subscription', () => {
      expect(pageContent).toContain('Current Plan');
      expect(pageContent).toMatch(/isCurrentTier/);
    });

    it('should have handleManageSubscription function', () => {
      expect(pageContent).toMatch(/function handleManageSubscription|const handleManageSubscription/);
    });

    it('should link to Stripe customer portal', () => {
      expect(pageContent).toMatch(/\/api\/stripe\/portal/);
    });

    it('should show "Manage subscription" link', () => {
      expect(pageContent).toContain('Manage subscription');
    });
  });

  describe('Success/Error Messages', () => {
    it('should use useSearchParams to check for success/canceled query params', () => {
      expect(pageContent).toMatch(/useSearchParams/);
      expect(pageContent).toMatch(/searchParams\.get.*success/);
      expect(pageContent).toMatch(/searchParams\.get.*canceled/);
    });

    it('should show success message when payment succeeds', () => {
      expect(pageContent).toMatch(/Payment successful/);
      expect(pageContent).toMatch(/credits have been added/);
    });

    it('should show canceled message when payment is canceled', () => {
      expect(pageContent).toMatch(/Payment was canceled/);
    });

    it('should conditionally render messages based on query params', () => {
      expect(pageContent).toMatch(/{success &&/);
      expect(pageContent).toMatch(/{canceled &&/);
    });
  });

  describe('Component Structure and Styling', () => {
    it('should be a client component', () => {
      expect(pageContent).toMatch(/["']use client["']/);
    });

    it('should have proper container styling', () => {
      expect(pageContent).toMatch(/p-8/);
      expect(pageContent).toMatch(/max-w-4xl/);
      expect(pageContent).toMatch(/mx-auto/);
    });

    it('should use grid layout for displaying options', () => {
      expect(pageContent).toMatch(/grid/);
      expect(pageContent).toMatch(/md:grid-cols|grid-cols-/);
    });

    it('should import icons from lucide-react', () => {
      expect(pageContent).toMatch(/import.*from.*["']lucide-react["']/);
      expect(pageContent).toMatch(/CreditCard|Check|Loader2|ExternalLink/);
    });

    it('should have responsive design classes', () => {
      expect(pageContent).toMatch(/md:|sm:|lg:/);
    });
  });

  describe('Integration with Supabase', () => {
    it('should import createBrowserClient from @supabase/ssr', () => {
      expect(pageContent).toMatch(/import.*createBrowserClient.*from.*@supabase\/ssr/);
    });

    it('should create Supabase client with env variables', () => {
      expect(pageContent).toMatch(/createBrowserClient/);
      expect(pageContent).toMatch(/NEXT_PUBLIC_SUPABASE_URL/);
      expect(pageContent).toMatch(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    });

    it('should fetch user authentication status', () => {
      expect(pageContent).toMatch(/supabase\.auth\.getUser/);
    });

    it('should use useEffect to fetch credits on component mount', () => {
      expect(pageContent).toMatch(/useEffect/);
      expect(pageContent).toMatch(/fetchCredits/);
    });

    it('should use useCallback for fetchCredits function', () => {
      expect(pageContent).toMatch(/useCallback/);
      expect(pageContent).toMatch(/fetchCredits/);
    });
  });

  describe('Data Flow', () => {
    it('should have credits state managed with useState', () => {
      expect(pageContent).toMatch(/const \[credits.*setCredits\] = useState/);
    });

    it('should have loading state managed with useState', () => {
      expect(pageContent).toMatch(/const \[loading.*setLoading\] = useState/);
    });

    it('should have purchasing state to track which pack is being purchased', () => {
      expect(pageContent).toMatch(/const \[purchasing.*setPurchasing\] = useState/);
    });

    it('should have subscriptionTier state', () => {
      expect(pageContent).toMatch(/const \[subscriptionTier.*setSubscriptionTier\] = useState/);
    });

    it('should handle errors gracefully', () => {
      expect(pageContent).toMatch(/try[\s\S]*catch|\.catch/);
      expect(pageContent).toMatch(/console\.error/);
    });
  });

  describe('User Interactions', () => {
    it('should have onClick handlers for purchase buttons', () => {
      expect(pageContent).toMatch(/onClick.*handlePurchase/);
    });

    it('should have onClick handler for manage subscription', () => {
      expect(pageContent).toMatch(/onClick.*handleManageSubscription/);
    });

    it('should redirect to Stripe checkout URL on successful purchase initiation', () => {
      expect(pageContent).toMatch(/window\.location\.href.*data\.url/);
    });

    it('should show loading spinner in button during purchase', () => {
      // Check that Loader2 is used in the purchasing context
      expect(pageContent).toContain('Loader2');
      expect(pageContent).toMatch(/purchasing.*===.*tier\.id|purchasing.*===.*pack\.id/);
    });

    it('should disable buttons during purchase', () => {
      expect(pageContent).toMatch(/disabled.*purchasing/);
    });
  });
});
