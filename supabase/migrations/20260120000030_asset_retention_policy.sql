-- =========================
-- GDPR-001: Asset Retention Policy
-- =========================
-- Creates configuration table and indexes to support automatic asset cleanup
-- based on configurable retention policies.

-- =========================
-- Asset Retention Configuration Table
-- =========================

CREATE TABLE IF NOT EXISTS public.asset_retention_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retention_days INTEGER NOT NULL DEFAULT 90,
  notification_before_days INTEGER NOT NULL DEFAULT 7,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_cleanup_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO public.asset_retention_config (retention_days, notification_before_days, enabled)
VALUES (90, 7, true)
ON CONFLICT DO NOTHING;

-- =========================
-- Asset Deletion Log Table
-- =========================
-- Tracks asset deletions for audit purposes

CREATE TABLE IF NOT EXISTS public.asset_deletion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  job_id UUID,
  asset_type TEXT NOT NULL,
  storage_path TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deletion_reason TEXT NOT NULL DEFAULT 'retention_policy',
  metadata_json JSONB DEFAULT '{}'
);

-- Create index for querying deletion logs by user
CREATE INDEX IF NOT EXISTS idx_asset_deletion_log_user_id ON public.asset_deletion_log(user_id);

-- Create index for querying deletion logs by date
CREATE INDEX IF NOT EXISTS idx_asset_deletion_log_deleted_at ON public.asset_deletion_log(deleted_at);

-- =========================
-- Add index on assets.created_at for efficient cleanup queries
-- =========================

CREATE INDEX IF NOT EXISTS idx_assets_created_at ON public.assets(created_at);

-- =========================
-- RLS Policies for asset_retention_config
-- =========================

ALTER TABLE public.asset_retention_config ENABLE ROW LEVEL SECURITY;

-- Only service role can modify retention config
CREATE POLICY "retention_config_service_role"
  ON public.asset_retention_config FOR ALL
  USING (auth.role() = 'service_role');

-- Admin users can view retention config
CREATE POLICY "retention_config_admin_select"
  ON public.asset_retention_config FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- =========================
-- RLS Policies for asset_deletion_log
-- =========================

ALTER TABLE public.asset_deletion_log ENABLE ROW LEVEL SECURITY;

-- Service role can do anything
CREATE POLICY "deletion_log_service_role"
  ON public.asset_deletion_log FOR ALL
  USING (auth.role() = 'service_role');

-- Users can view their own deletion logs
CREATE POLICY "deletion_log_select_own"
  ON public.asset_deletion_log FOR SELECT
  USING (user_id = auth.uid());

-- Admin users can view all deletion logs
CREATE POLICY "deletion_log_admin_select"
  ON public.asset_deletion_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- =========================
-- Function to log asset deletions
-- =========================

CREATE OR REPLACE FUNCTION public.log_asset_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if deletion is due to retention policy (not cascading deletes)
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.asset_deletion_log (
      asset_id,
      user_id,
      job_id,
      asset_type,
      storage_path,
      size_bytes,
      created_at,
      metadata_json
    ) VALUES (
      OLD.id,
      OLD.user_id,
      OLD.job_id,
      OLD.type,
      OLD.storage_path,
      OLD.size_bytes,
      OLD.created_at,
      OLD.metadata_json
    );
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to log asset deletions
DROP TRIGGER IF EXISTS trigger_log_asset_deletion ON public.assets;
CREATE TRIGGER trigger_log_asset_deletion
  BEFORE DELETE ON public.assets
  FOR EACH ROW
  EXECUTE FUNCTION public.log_asset_deletion();

-- =========================
-- Comments
-- =========================

COMMENT ON TABLE public.asset_retention_config IS 'Configuration for automatic asset cleanup retention policy (GDPR-001)';
COMMENT ON COLUMN public.asset_retention_config.retention_days IS 'Number of days to retain assets before automatic deletion';
COMMENT ON COLUMN public.asset_retention_config.notification_before_days IS 'Number of days before deletion to notify users';
COMMENT ON COLUMN public.asset_retention_config.enabled IS 'Whether automatic cleanup is enabled';
COMMENT ON COLUMN public.asset_retention_config.last_cleanup_at IS 'Timestamp of last successful cleanup run';

COMMENT ON TABLE public.asset_deletion_log IS 'Audit log of asset deletions for GDPR compliance';
COMMENT ON COLUMN public.asset_deletion_log.deletion_reason IS 'Reason for deletion (e.g., retention_policy, user_request, admin_action)';
