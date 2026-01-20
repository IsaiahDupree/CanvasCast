/**
 * Appeals Table Migration (MOD-004)
 *
 * Creates an appeals table for users to contest moderation decisions.
 * This table stores:
 * - Appeal submissions with user reasoning
 * - Links to original audit log entries
 * - Resolution status and admin decisions
 * - Timestamps for tracking resolution time
 *
 * Workflow:
 * 1. User submits appeal with reason
 * 2. Appeal enters 'pending' queue
 * 3. Admin reviews and approves/denies
 * 4. User is notified of decision
 */

-- Create appeal_status enum
DO $$ BEGIN
  CREATE TYPE appeal_status AS ENUM ('pending', 'approved', 'denied');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create appeals table
CREATE TABLE IF NOT EXISTS public.appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- User who submitted the appeal
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Reference to the audit log entry (if available)
  audit_log_id UUID REFERENCES public.audit_log(id) ON DELETE SET NULL,

  -- User's reasoning for the appeal
  reason TEXT NOT NULL CHECK (length(reason) >= 10),

  -- The original content that was moderated
  original_content TEXT NOT NULL,

  -- Current status of the appeal
  status appeal_status NOT NULL DEFAULT 'pending',

  -- Resolution details
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes TEXT,

  -- Additional metadata (IP address, user agent, etc.)
  metadata JSONB DEFAULT '{}'::jsonb,

  -- For full-text search on reason and content
  search_tsv TSVECTOR,

  -- Ensure resolution fields are set together
  CONSTRAINT resolution_check CHECK (
    (status = 'pending' AND resolved_at IS NULL AND resolved_by IS NULL) OR
    (status IN ('approved', 'denied') AND resolved_at IS NOT NULL)
  )
);

-- Create indexes
CREATE INDEX idx_appeals_user_id ON public.appeals(user_id);
CREATE INDEX idx_appeals_audit_log_id ON public.appeals(audit_log_id);
CREATE INDEX idx_appeals_status ON public.appeals(status);
CREATE INDEX idx_appeals_created_at ON public.appeals(created_at DESC);
CREATE INDEX idx_appeals_resolved_at ON public.appeals(resolved_at DESC) WHERE resolved_at IS NOT NULL;

-- Create GIN index for full-text search
CREATE INDEX idx_appeals_search_tsv ON public.appeals USING GIN (search_tsv);

-- Create trigger to automatically update the full-text search vector
CREATE OR REPLACE FUNCTION appeals_search_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_tsv := to_tsvector('english',
    COALESCE(NEW.reason, '') || ' ' ||
    COALESCE(NEW.original_content, '') || ' ' ||
    COALESCE(NEW.resolution_notes, '')
  );
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER appeals_search_tsv_update
  BEFORE INSERT OR UPDATE ON public.appeals
  FOR EACH ROW
  EXECUTE FUNCTION appeals_search_tsv_trigger();

-- Add comments to table
COMMENT ON TABLE public.appeals IS 'User appeals for contested moderation decisions';
COMMENT ON COLUMN public.appeals.reason IS 'User explanation for why they believe the content was incorrectly flagged';
COMMENT ON COLUMN public.appeals.original_content IS 'The content that was moderated/blocked';
COMMENT ON COLUMN public.appeals.status IS 'Current appeal status: pending, approved, denied';
COMMENT ON COLUMN public.appeals.resolved_at IS 'When the appeal was resolved by an admin';
COMMENT ON COLUMN public.appeals.resolved_by IS 'Admin user who resolved the appeal';
COMMENT ON COLUMN public.appeals.resolution_notes IS 'Admin notes explaining the decision';

-- ==================================================================
-- Row Level Security (RLS) Policies
-- ==================================================================

ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own appeals
CREATE POLICY "Users can view own appeals"
  ON public.appeals
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can create appeals
CREATE POLICY "Users can create appeals"
  ON public.appeals
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users cannot update appeals after submission
-- (Admins update via service role)

-- Policy: Users cannot delete appeals
-- (Only admins via service role can delete if needed)

-- Policy: Service role has full access (for admin operations)
CREATE POLICY "Service role full access"
  ON public.appeals
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ==================================================================
-- Helper Functions
-- ==================================================================

/**
 * Function to submit an appeal
 *
 * @param p_user_id - The user submitting the appeal
 * @param p_audit_log_id - Optional reference to audit log entry
 * @param p_reason - User's explanation (min 10 chars)
 * @param p_original_content - The content that was moderated
 * @param p_metadata - Optional metadata
 * @returns The ID of the created appeal
 */
CREATE OR REPLACE FUNCTION public.submit_appeal(
  p_user_id UUID,
  p_audit_log_id UUID,
  p_reason TEXT,
  p_original_content TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  v_appeal_id UUID;
BEGIN
  -- Validate reason length
  IF length(p_reason) < 10 THEN
    RAISE EXCEPTION 'Appeal reason must be at least 10 characters';
  END IF;

  -- Insert the appeal
  INSERT INTO public.appeals (
    user_id,
    audit_log_id,
    reason,
    original_content,
    status,
    metadata
  ) VALUES (
    p_user_id,
    p_audit_log_id,
    p_reason,
    p_original_content,
    'pending',
    p_metadata
  )
  RETURNING id INTO v_appeal_id;

  -- Log the appeal submission to audit log
  PERFORM public.log_audit_entry(
    p_user_id,
    'appeal_filed',
    p_original_content,
    jsonb_build_object('appeal_id', v_appeal_id, 'reason', p_reason),
    p_metadata
  );

  RETURN v_appeal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.submit_appeal TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_appeal TO service_role;

/**
 * Function to resolve an appeal (admin only)
 *
 * @param p_appeal_id - The appeal to resolve
 * @param p_resolved_by - Admin user ID
 * @param p_status - New status: 'approved' or 'denied'
 * @param p_resolution_notes - Admin explanation
 * @returns TRUE if successful
 */
CREATE OR REPLACE FUNCTION public.resolve_appeal(
  p_appeal_id UUID,
  p_resolved_by UUID,
  p_status appeal_status,
  p_resolution_notes TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_appeal RECORD;
BEGIN
  -- Validate status
  IF p_status NOT IN ('approved', 'denied') THEN
    RAISE EXCEPTION 'Status must be approved or denied';
  END IF;

  -- Validate resolution notes
  IF p_resolution_notes IS NULL OR length(p_resolution_notes) < 10 THEN
    RAISE EXCEPTION 'Resolution notes must be at least 10 characters';
  END IF;

  -- Get the appeal
  SELECT * INTO v_appeal
  FROM public.appeals
  WHERE id = p_appeal_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appeal not found';
  END IF;

  IF v_appeal.status != 'pending' THEN
    RAISE EXCEPTION 'Appeal has already been resolved';
  END IF;

  -- Update the appeal
  UPDATE public.appeals
  SET
    status = p_status,
    resolved_at = now(),
    resolved_by = p_resolved_by,
    resolution_notes = p_resolution_notes
  WHERE id = p_appeal_id;

  -- Log the resolution to audit log
  PERFORM public.log_audit_entry(
    v_appeal.user_id,
    'appeal_resolved',
    v_appeal.original_content,
    jsonb_build_object(
      'appeal_id', p_appeal_id,
      'decision', p_status,
      'resolved_by', p_resolved_by,
      'notes', p_resolution_notes
    )
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role only (admin operations)
GRANT EXECUTE ON FUNCTION public.resolve_appeal TO service_role;

/**
 * Function to get pending appeals (admin only)
 * Used by admin dashboard to view appeals queue
 *
 * @param p_limit - Max results to return (default 50)
 * @param p_offset - Offset for pagination (default 0)
 */
CREATE OR REPLACE FUNCTION public.get_pending_appeals(
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
) RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  user_id UUID,
  audit_log_id UUID,
  reason TEXT,
  original_content TEXT,
  status appeal_status,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.created_at,
    a.user_id,
    a.audit_log_id,
    a.reason,
    a.original_content,
    a.status,
    a.metadata
  FROM public.appeals a
  WHERE a.status = 'pending'
  ORDER BY a.created_at ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role only
GRANT EXECUTE ON FUNCTION public.get_pending_appeals TO service_role;

/**
 * Function to search all appeals with filters (admin only)
 *
 * @param p_status - Filter by status (optional)
 * @param p_user_id - Filter by user (optional)
 * @param p_search_term - Full-text search term (optional)
 * @param p_limit - Max results to return (default 50)
 * @param p_offset - Offset for pagination (default 0)
 */
CREATE OR REPLACE FUNCTION public.search_appeals(
  p_status appeal_status DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_search_term TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
) RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  user_id UUID,
  audit_log_id UUID,
  reason TEXT,
  original_content TEXT,
  status appeal_status,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.created_at,
    a.updated_at,
    a.user_id,
    a.audit_log_id,
    a.reason,
    a.original_content,
    a.status,
    a.resolved_at,
    a.resolved_by,
    a.resolution_notes,
    a.metadata
  FROM public.appeals a
  WHERE
    (p_status IS NULL OR a.status = p_status)
    AND (p_user_id IS NULL OR a.user_id = p_user_id)
    AND (p_search_term IS NULL OR a.search_tsv @@ plainto_tsquery('english', p_search_term))
  ORDER BY
    CASE WHEN a.status = 'pending' THEN 0 ELSE 1 END,
    a.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role only
GRANT EXECUTE ON FUNCTION public.search_appeals TO service_role;

-- ==================================================================
-- Verification Queries (for testing)
-- ==================================================================

-- Test that table exists and has correct structure
DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'appeals') = 1,
         'appeals table should exist';

  ASSERT (SELECT COUNT(*) FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'appeals'
          AND column_name IN ('id', 'created_at', 'user_id', 'audit_log_id', 'reason', 'original_content', 'status', 'resolved_at', 'resolved_by', 'resolution_notes')) = 10,
         'appeals should have all required columns';

  ASSERT (SELECT COUNT(*) FROM pg_type WHERE typname = 'appeal_status') = 1,
         'appeal_status enum should exist';
END $$;
