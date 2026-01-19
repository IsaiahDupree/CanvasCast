-- =========================
-- DB-010: Credit Balance RPC Function
-- DB-011: Reserve Credits RPC Function
-- DB-012: Finalize Job Credits RPC Function
-- DB-013: Release Job Credits RPC Function
-- =========================
-- Creates RPC functions for credit management:
-- - get_credit_balance: Returns current credit balance for a user
-- - reserve_credits: Reserves credits for a job (returns true/false)
-- - finalize_job_credits: Finalizes credits after job completion
-- - release_job_credits: Releases reserved credits on job failure

-- =========================
-- DB-010: get_credit_balance
-- =========================
-- Returns the current credit balance for a user
-- Handles null case (returns 0 if no transactions)

CREATE OR REPLACE FUNCTION public.get_credit_balance(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(SUM(amount), 0)::INTEGER
  FROM public.credit_ledger
  WHERE user_id = p_user_id;
$$;

-- Add comment
COMMENT ON FUNCTION public.get_credit_balance(UUID) IS
'Returns the current credit balance for a user by summing all transactions. Returns 0 if user has no transactions.';

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_credit_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_credit_balance(UUID) TO service_role;

-- =========================
-- DB-011: reserve_credits
-- =========================
-- Reserves credits for a job
-- Returns TRUE if successful, FALSE if insufficient balance

-- Drop existing function if it exists (may have different signature)
DROP FUNCTION IF EXISTS public.reserve_credits(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS public.reserve_credits(UUID, UUID, INT);

CREATE OR REPLACE FUNCTION public.reserve_credits(
  p_user_id UUID,
  p_job_id UUID,
  p_amount INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  -- Get current balance
  SELECT public.get_credit_balance(p_user_id) INTO v_balance;

  -- Check if sufficient balance
  IF v_balance < p_amount THEN
    RETURN FALSE;
  END IF;

  -- Reserve credits (negative amount)
  INSERT INTO public.credit_ledger (user_id, type, amount, job_id, note)
  VALUES (p_user_id, 'reserve', -p_amount, p_job_id, 'Reserved for job');

  RETURN TRUE;
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.reserve_credits(UUID, UUID, INTEGER) IS
'Reserves credits for a job. Returns TRUE if sufficient balance, FALSE otherwise. Deducts credits from available balance.';

-- Grant execute to service role only (not directly callable by users)
GRANT EXECUTE ON FUNCTION public.reserve_credits(UUID, UUID, INTEGER) TO service_role;

-- =========================
-- DB-012: finalize_job_credits
-- =========================
-- Finalizes credits after job completion
-- If actual cost is less than reserved, refunds the difference

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.finalize_job_credits(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS public.finalize_job_credits(UUID, UUID, INT);

CREATE OR REPLACE FUNCTION public.finalize_job_credits(
  p_user_id UUID,
  p_job_id UUID,
  p_final_cost INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reserved INTEGER;
BEGIN
  -- Get reserved amount (absolute value)
  SELECT ABS(amount) INTO v_reserved
  FROM public.credit_ledger
  WHERE job_id = p_job_id AND type = 'reserve'
  LIMIT 1;

  -- If no reservation found, exit
  IF v_reserved IS NULL THEN
    RETURN;
  END IF;

  -- If final cost is less than reserved, refund difference
  IF p_final_cost < v_reserved THEN
    INSERT INTO public.credit_ledger (user_id, type, amount, job_id, note)
    VALUES (
      p_user_id,
      'refund',
      v_reserved - p_final_cost,
      p_job_id,
      'Partial refund - actual cost less than reserved'
    );
  END IF;

  -- Mark reserved credits as used (change type from 'reserve' to 'usage')
  UPDATE public.credit_ledger
  SET
    type = 'usage',
    note = 'Video generation completed'
  WHERE job_id = p_job_id AND type = 'reserve';
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.finalize_job_credits(UUID, UUID, INTEGER) IS
'Finalizes credits after job completion. Converts reserved credits to usage and refunds any difference if final cost < reserved.';

-- Grant execute to service role only
GRANT EXECUTE ON FUNCTION public.finalize_job_credits(UUID, UUID, INTEGER) TO service_role;

-- =========================
-- DB-013: release_job_credits
-- =========================
-- Releases reserved credits on job failure
-- Converts reserve transaction to refund

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.release_job_credits(UUID);

CREATE OR REPLACE FUNCTION public.release_job_credits(p_job_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete the reserve transaction to release the credits
  -- This effectively refunds the credits by removing the negative transaction
  DELETE FROM public.credit_ledger
  WHERE job_id = p_job_id AND type = 'reserve';
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.release_job_credits(UUID) IS
'Releases reserved credits on job failure. Deletes the reserve transaction to restore the balance.';

-- Grant execute to service role only
GRANT EXECUTE ON FUNCTION public.release_job_credits(UUID) TO service_role;
