-- =========================
-- DB-006: Credit Ledger Table Migration
-- =========================
-- Creates credit_ledger table for tracking all credit transactions with:
-- - Transaction type enum (purchase, usage, refund, grant, expire, reserve)
-- - FK to auth.users for user tracking
-- - FK to jobs for job-related transactions
-- - Stripe payment reference for purchases
-- - Balance tracking via balance_after column
-- - Proper indexes for fast queries
-- - RLS policies

-- =========================
-- Update ledger_type enum
-- =========================
-- Note: ledger_type already exists with values: purchase, reserve, release, spend, refund, admin_adjust
-- Add missing values for PRD compliance: usage, grant, expire
DO $$
BEGIN
  -- Add new values to existing ledger_type enum if they don't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'usage' AND enumtypid = 'public.ledger_type'::regtype) THEN
    ALTER TYPE public.ledger_type ADD VALUE 'usage';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'grant' AND enumtypid = 'public.ledger_type'::regtype) THEN
    ALTER TYPE public.ledger_type ADD VALUE 'grant';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'expire' AND enumtypid = 'public.ledger_type'::regtype) THEN
    ALTER TYPE public.ledger_type ADD VALUE 'expire';
  END IF;
END $$;

-- =========================
-- Create or update credit_ledger table
-- =========================
-- Note: Table may already exist from initial schema
-- This migration adds missing columns per PRD

CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.ledger_type NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER,
  note TEXT,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  stripe_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns if they don't exist (idempotent)
ALTER TABLE public.credit_ledger ADD COLUMN IF NOT EXISTS balance_after INTEGER;
ALTER TABLE public.credit_ledger ADD COLUMN IF NOT EXISTS stripe_payment_id TEXT;

-- =========================
-- Create indexes for performance
-- =========================

-- Index on user_id for fast balance queries and transaction history
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_id ON public.credit_ledger(user_id);

-- Index on job_id for job-related credit queries
CREATE INDEX IF NOT EXISTS idx_credit_ledger_job_id ON public.credit_ledger(job_id);

-- Index on created_at for transaction history sorting
CREATE INDEX IF NOT EXISTS idx_credit_ledger_created_at ON public.credit_ledger(created_at DESC);

-- Composite index for user transaction history queries
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_created ON public.credit_ledger(user_id, created_at DESC);

-- Index on stripe_payment_id for idempotency checks
CREATE INDEX IF NOT EXISTS idx_credit_ledger_stripe ON public.credit_ledger(stripe_payment_id) WHERE stripe_payment_id IS NOT NULL;

-- =========================
-- RLS Policies
-- =========================

ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid duplicates
DROP POLICY IF EXISTS "credit_ledger_select_own" ON public.credit_ledger;
DROP POLICY IF EXISTS "credit_ledger_insert_service" ON public.credit_ledger;
DROP POLICY IF EXISTS "credit_ledger_update_service" ON public.credit_ledger;
DROP POLICY IF EXISTS "credit_ledger_service_role" ON public.credit_ledger;

-- Users can view their own credit transactions
CREATE POLICY "credit_ledger_select_own"
  ON public.credit_ledger FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert/update credit ledger
-- Users cannot directly insert credits (must go through RPC functions)
CREATE POLICY "credit_ledger_service_role"
  ON public.credit_ledger FOR ALL
  USING (auth.role() = 'service_role');

-- =========================
-- Trigger to calculate balance_after
-- =========================

-- Function to calculate and set balance_after on insert
CREATE OR REPLACE FUNCTION public.calculate_balance_after()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_previous_balance INTEGER;
BEGIN
  -- Get the most recent balance for this user
  SELECT COALESCE(balance_after, 0) INTO v_previous_balance
  FROM public.credit_ledger
  WHERE user_id = NEW.user_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  -- If no previous balance, start from 0
  v_previous_balance := COALESCE(v_previous_balance, 0);

  -- Calculate new balance
  NEW.balance_after := v_previous_balance + NEW.amount;

  RETURN NEW;
END;
$$;

-- Create trigger to auto-calculate balance
DROP TRIGGER IF EXISTS trg_credit_ledger_balance ON public.credit_ledger;
CREATE TRIGGER trg_credit_ledger_balance
  BEFORE INSERT ON public.credit_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_balance_after();

-- =========================
-- Add table and column comments
-- =========================

COMMENT ON TABLE public.credit_ledger IS 'Ledger of all credit transactions (purchases, usage, refunds, grants)';
COMMENT ON COLUMN public.credit_ledger.id IS 'Primary key';
COMMENT ON COLUMN public.credit_ledger.user_id IS 'FK to auth.users - transaction owner';
COMMENT ON COLUMN public.credit_ledger.type IS 'Transaction type: purchase/usage/refund/grant/expire/reserve';
COMMENT ON COLUMN public.credit_ledger.amount IS 'Credit amount: positive = add, negative = deduct';
COMMENT ON COLUMN public.credit_ledger.balance_after IS 'Running balance after this transaction';
COMMENT ON COLUMN public.credit_ledger.note IS 'Human-readable description of transaction';
COMMENT ON COLUMN public.credit_ledger.job_id IS 'FK to jobs - if transaction is job-related (usage/reserve/refund)';
COMMENT ON COLUMN public.credit_ledger.stripe_payment_id IS 'Stripe payment intent ID for purchases (for idempotency)';
COMMENT ON COLUMN public.credit_ledger.created_at IS 'When transaction occurred';
