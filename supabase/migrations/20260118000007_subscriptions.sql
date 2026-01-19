-- =========================
-- DB-007: Subscriptions Table Migration
-- =========================
-- Creates subscriptions table for Stripe subscription management with:
-- - FK to auth.users for user tracking
-- - Stripe subscription and customer IDs
-- - Plan type (hobbyist/creator/business)
-- - Status tracking (active/canceled/past_due)
-- - Billing period tracking
-- - Credits per month allocation
-- - Cancellation flag
-- - Proper indexes for Stripe ID lookups
-- - RLS policies

-- =========================
-- Create subscription_plan enum
-- =========================
DO $$
BEGIN
  -- Create subscription_plan enum if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_plan') THEN
    CREATE TYPE public.subscription_plan AS ENUM ('hobbyist', 'creator', 'business');
  END IF;
END $$;

-- =========================
-- Create subscription_status enum
-- =========================
DO $$
BEGIN
  -- Create subscription_status enum if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE public.subscription_status AS ENUM ('active', 'canceled', 'past_due');
  END IF;
END $$;

-- =========================
-- Create subscriptions table
-- =========================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  plan public.subscription_plan NOT NULL,
  status public.subscription_status NOT NULL,
  credits_per_month INTEGER NOT NULL,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- Create indexes for performance
-- =========================

-- Index on user_id for fast user subscription lookup
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
  ON public.subscriptions(user_id);

-- Index on stripe_subscription_id for webhook lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub_id
  ON public.subscriptions(stripe_subscription_id);

-- Index on stripe_customer_id for customer lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id
  ON public.subscriptions(stripe_customer_id);

-- Index on status for active subscription queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON public.subscriptions(status);

-- Composite index for user's active subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status
  ON public.subscriptions(user_id, status);

-- =========================
-- RLS Policies
-- =========================

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid duplicates
DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_service_role" ON public.subscriptions;

-- Users can view their own subscription
CREATE POLICY "subscriptions_select_own"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert/update/delete subscriptions
-- (Subscriptions are managed via Stripe webhooks)
CREATE POLICY "subscriptions_service_role"
  ON public.subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- =========================
-- Trigger to update updated_at timestamp
-- =========================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_subscriptions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_subscriptions_updated_at();

-- =========================
-- Add table and column comments
-- =========================

COMMENT ON TABLE public.subscriptions IS 'Stripe subscription records for users with monthly credit allowances';
COMMENT ON COLUMN public.subscriptions.id IS 'Primary key';
COMMENT ON COLUMN public.subscriptions.user_id IS 'FK to auth.users - subscription owner';
COMMENT ON COLUMN public.subscriptions.stripe_subscription_id IS 'Stripe subscription ID for webhook processing';
COMMENT ON COLUMN public.subscriptions.stripe_customer_id IS 'Stripe customer ID';
COMMENT ON COLUMN public.subscriptions.plan IS 'Subscription plan: hobbyist/creator/business';
COMMENT ON COLUMN public.subscriptions.status IS 'Subscription status: active/canceled/past_due';
COMMENT ON COLUMN public.subscriptions.credits_per_month IS 'Monthly credit allocation (30/100/300)';
COMMENT ON COLUMN public.subscriptions.current_period_start IS 'Current billing period start date';
COMMENT ON COLUMN public.subscriptions.current_period_end IS 'Current billing period end date';
COMMENT ON COLUMN public.subscriptions.cancel_at_period_end IS 'Whether subscription will cancel at period end';
COMMENT ON COLUMN public.subscriptions.created_at IS 'When subscription was created';
COMMENT ON COLUMN public.subscriptions.updated_at IS 'When subscription was last updated';
