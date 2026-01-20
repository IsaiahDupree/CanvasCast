-- =========================
-- Account Deletion Requests Table
-- =========================
-- For GDPR-002: Account Deletion feature
-- Tracks user requests to delete their account and all associated data

-- Create account_deletion_requests table
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_deletion_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'cancelled', 'completed')),
  reason TEXT,
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_deletion_requests_user_id ON public.account_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON public.account_deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_scheduled_date ON public.account_deletion_requests(scheduled_deletion_date);

-- Add unique constraint to prevent multiple pending requests per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_deletion_requests_pending_user
  ON public.account_deletion_requests(user_id)
  WHERE status = 'pending';

-- Add comments
COMMENT ON TABLE public.account_deletion_requests IS 'Tracks user account deletion requests for GDPR compliance';
COMMENT ON COLUMN public.account_deletion_requests.user_id IS 'The user requesting account deletion';
COMMENT ON COLUMN public.account_deletion_requests.requested_at IS 'When the deletion was requested';
COMMENT ON COLUMN public.account_deletion_requests.scheduled_deletion_date IS 'When the account will be deleted (30 days grace period)';
COMMENT ON COLUMN public.account_deletion_requests.status IS 'Status: pending, cancelled, or completed';
COMMENT ON COLUMN public.account_deletion_requests.reason IS 'Optional reason provided by user';

-- Enable RLS
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own deletion requests
CREATE POLICY "Users can view own deletion requests"
  ON public.account_deletion_requests
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own deletion requests
CREATE POLICY "Users can create own deletion requests"
  ON public.account_deletion_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own deletion requests (for cancellation)
CREATE POLICY "Users can update own deletion requests"
  ON public.account_deletion_requests
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can view all deletion requests
CREATE POLICY "Admins can view all deletion requests"
  ON public.account_deletion_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_account_deletion_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_update_account_deletion_requests_updated_at
  BEFORE UPDATE ON public.account_deletion_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_account_deletion_requests_updated_at();

-- =========================
-- RPC Function: Request Account Deletion
-- =========================
CREATE OR REPLACE FUNCTION public.request_account_deletion(
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  scheduled_date TIMESTAMPTZ,
  message TEXT
) AS $$
DECLARE
  v_scheduled_date TIMESTAMPTZ;
  v_existing_request UUID;
BEGIN
  -- Check if user already has a pending deletion request
  SELECT id INTO v_existing_request
  FROM public.account_deletion_requests
  WHERE user_id = p_user_id AND status = 'pending'
  LIMIT 1;

  IF v_existing_request IS NOT NULL THEN
    RETURN QUERY SELECT
      FALSE,
      NULL::TIMESTAMPTZ,
      'A deletion request is already pending for this account'::TEXT;
    RETURN;
  END IF;

  -- Calculate scheduled deletion date (30 days from now)
  v_scheduled_date := NOW() + INTERVAL '30 days';

  -- Create deletion request
  INSERT INTO public.account_deletion_requests (
    user_id,
    scheduled_deletion_date,
    reason,
    status
  ) VALUES (
    p_user_id,
    v_scheduled_date,
    p_reason,
    'pending'
  );

  RETURN QUERY SELECT
    TRUE,
    v_scheduled_date,
    'Your account deletion request has been received. Your account will be deleted on ' ||
    TO_CHAR(v_scheduled_date, 'YYYY-MM-DD') || '. You can cancel this request before that date.'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================
-- RPC Function: Cancel Account Deletion
-- =========================
CREATE OR REPLACE FUNCTION public.cancel_account_deletion(
  p_user_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_request_id UUID;
BEGIN
  -- Find pending deletion request
  SELECT id INTO v_request_id
  FROM public.account_deletion_requests
  WHERE user_id = p_user_id AND status = 'pending'
  LIMIT 1;

  IF v_request_id IS NULL THEN
    RETURN QUERY SELECT
      FALSE,
      'No pending deletion request found'::TEXT;
    RETURN;
  END IF;

  -- Update request to cancelled
  UPDATE public.account_deletion_requests
  SET
    status = 'cancelled',
    cancelled_at = NOW()
  WHERE id = v_request_id;

  RETURN QUERY SELECT
    TRUE,
    'Your account deletion request has been cancelled'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================
-- RPC Function: Get Deletion Status
-- =========================
CREATE OR REPLACE FUNCTION public.get_account_deletion_status(
  p_user_id UUID
)
RETURNS TABLE (
  has_pending_deletion BOOLEAN,
  scheduled_date TIMESTAMPTZ,
  can_cancel BOOLEAN,
  requested_at TIMESTAMPTZ,
  reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE WHEN adr.id IS NOT NULL THEN TRUE ELSE FALSE END,
    adr.scheduled_deletion_date,
    CASE WHEN adr.id IS NOT NULL AND adr.scheduled_deletion_date > NOW() THEN TRUE ELSE FALSE END,
    adr.requested_at,
    adr.reason
  FROM public.account_deletion_requests adr
  WHERE adr.user_id = p_user_id AND adr.status = 'pending'
  LIMIT 1;

  -- If no pending request, return default values
  IF NOT FOUND THEN
    RETURN QUERY SELECT
      FALSE,
      NULL::TIMESTAMPTZ,
      FALSE,
      NULL::TIMESTAMPTZ,
      NULL::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.request_account_deletion TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_account_deletion TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_account_deletion_status TO authenticated;
