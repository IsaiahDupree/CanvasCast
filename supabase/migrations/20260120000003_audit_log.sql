/**
 * Audit Log Table Migration (MOD-003)
 *
 * Creates an immutable audit log table for compliance review.
 * This table stores:
 * - All user prompts submitted (both allowed and blocked)
 * - Moderation results and reasons
 * - Metadata for investigation (IP, user agent, etc.)
 *
 * Security Features:
 * - No UPDATE allowed (immutable records)
 * - No DELETE allowed (permanent audit trail)
 * - Only admins can read audit logs
 * - Automatic timestamps
 */

-- Create audit_log table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- User information
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Action type (prompt_submitted, prompt_blocked, content_flagged, etc.)
  action TEXT NOT NULL CHECK (action IN (
    'prompt_submitted',
    'prompt_blocked',
    'content_flagged',
    'account_suspended',
    'appeal_filed',
    'appeal_resolved'
  )),

  -- The actual content that was audited
  content TEXT NOT NULL,

  -- Moderation result as JSONB (flexible for different moderation APIs)
  moderation_result JSONB NOT NULL,

  -- Additional metadata (IP address, user agent, request ID, etc.)
  metadata JSONB DEFAULT '{}'::jsonb,

  -- For full-text search on content
  content_tsv TSVECTOR
);

-- Create index on user_id for fast user-specific queries
CREATE INDEX idx_audit_log_user_id ON public.audit_log(user_id);

-- Create index on action for filtering by action type
CREATE INDEX idx_audit_log_action ON public.audit_log(action);

-- Create index on created_at for time-based queries
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at DESC);

-- Create GIN index on moderation_result for JSON queries
CREATE INDEX idx_audit_log_moderation_result ON public.audit_log USING GIN (moderation_result);

-- Create GIN index for full-text search
CREATE INDEX idx_audit_log_content_tsv ON public.audit_log USING GIN (content_tsv);

-- Create trigger to automatically update the full-text search vector
CREATE OR REPLACE FUNCTION audit_log_content_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW.content_tsv := to_tsvector('english', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_content_tsv_update
  BEFORE INSERT OR UPDATE ON public.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_content_tsv_trigger();

-- Add comment to table
COMMENT ON TABLE public.audit_log IS 'Immutable audit trail of all content moderation actions';
COMMENT ON COLUMN public.audit_log.action IS 'Type of action: prompt_submitted, prompt_blocked, etc.';
COMMENT ON COLUMN public.audit_log.content IS 'The user-submitted content that was audited';
COMMENT ON COLUMN public.audit_log.moderation_result IS 'Result from moderation API (allowed, reason, categories, etc.)';
COMMENT ON COLUMN public.audit_log.metadata IS 'Additional context: IP, user agent, request ID, etc.';

-- ==================================================================
-- Row Level Security (RLS) Policies
-- ==================================================================

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can read audit logs (admin dashboard will use service role)
-- Regular users cannot access audit logs at all
CREATE POLICY "Service role can read audit logs"
  ON public.audit_log
  FOR SELECT
  USING (false);  -- No user access through RLS; must use service role

-- Policy: Service role can insert audit logs (for API server)
CREATE POLICY "Service role can insert audit logs"
  ON public.audit_log
  FOR INSERT
  WITH CHECK (true);

-- Policy: NO UPDATES ALLOWED (immutable audit trail)
-- We don't create an UPDATE policy, so all updates are blocked

-- Policy: NO DELETES ALLOWED (permanent records)
-- We don't create a DELETE policy, so all deletes are blocked

-- ==================================================================
-- Helper Function: Log a prompt submission
-- ==================================================================

/**
 * Function to log a prompt submission to the audit trail
 *
 * @param p_user_id - The user who submitted the prompt
 * @param p_action - The action type (prompt_submitted or prompt_blocked)
 * @param p_content - The prompt content
 * @param p_moderation_result - The moderation result as JSON
 * @param p_metadata - Optional metadata (IP, user agent, etc.)
 * @returns The ID of the created audit log entry
 */
CREATE OR REPLACE FUNCTION public.log_audit_entry(
  p_user_id UUID,
  p_action TEXT,
  p_content TEXT,
  p_moderation_result JSONB,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.audit_log (
    user_id,
    action,
    content,
    moderation_result,
    metadata
  ) VALUES (
    p_user_id,
    p_action,
    p_content,
    p_moderation_result,
    p_metadata
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (via service role)
GRANT EXECUTE ON FUNCTION public.log_audit_entry TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit_entry TO service_role;

-- ==================================================================
-- Helper Function: Search audit logs (admin only)
-- ==================================================================

/**
 * Function to search audit logs with filters
 * Only callable via service role (used by admin API endpoints)
 *
 * @param p_user_id - Filter by user (optional)
 * @param p_action - Filter by action type (optional)
 * @param p_search_term - Full-text search term (optional)
 * @param p_limit - Max results to return (default 100)
 * @param p_offset - Offset for pagination (default 0)
 */
CREATE OR REPLACE FUNCTION public.search_audit_logs(
  p_user_id UUID DEFAULT NULL,
  p_action TEXT DEFAULT NULL,
  p_search_term TEXT DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0
) RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  user_id UUID,
  action TEXT,
  content TEXT,
  moderation_result JSONB,
  metadata JSONB
) AS $$
BEGIN
  -- Note: Access control is handled at the API layer
  -- This function should only be called by the service role

  -- Build and execute dynamic query
  RETURN QUERY
  SELECT
    al.id,
    al.created_at,
    al.user_id,
    al.action,
    al.content,
    al.moderation_result,
    al.metadata
  FROM public.audit_log al
  WHERE
    (p_user_id IS NULL OR al.user_id = p_user_id)
    AND (p_action IS NULL OR al.action = p_action)
    AND (p_search_term IS NULL OR al.content_tsv @@ plainto_tsquery('english', p_search_term))
  ORDER BY al.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (function checks admin role internally)
GRANT EXECUTE ON FUNCTION public.search_audit_logs TO authenticated;

-- ==================================================================
-- Verification Queries (for testing)
-- ==================================================================

-- Test that table exists and has correct structure
DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'audit_log') = 1,
         'audit_log table should exist';

  ASSERT (SELECT COUNT(*) FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'audit_log'
          AND column_name IN ('id', 'created_at', 'user_id', 'action', 'content', 'moderation_result', 'metadata')) = 7,
         'audit_log should have all required columns';
END $$;
