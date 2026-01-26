/**
 * API Key Usage Notifications Table
 * Feature: RATE-004
 *
 * Tracks webhook notifications sent when API key usage exceeds thresholds.
 * Prevents duplicate notifications.
 */

-- Create api_key_usage_notifications table
CREATE TABLE IF NOT EXISTS public.api_key_usage_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  threshold_percentage INTEGER NOT NULL, -- e.g., 80, 90, 100
  usage_count BIGINT NOT NULL,
  usage_limit INTEGER NOT NULL, -- Renamed from 'limit' to avoid reserved keyword
  notified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_reset_at TIMESTAMPTZ NOT NULL,

  -- Prevent duplicate notifications for same window
  UNIQUE(api_key_id, threshold_percentage, window_reset_at)
);

-- Create index on api_key_id for efficient lookups
CREATE INDEX IF NOT EXISTS idx_api_key_notifications_key_id
  ON public.api_key_usage_notifications(api_key_id);

-- Create index on notified_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_api_key_notifications_notified_at
  ON public.api_key_usage_notifications(notified_at);

-- Add RLS policies
ALTER TABLE public.api_key_usage_notifications ENABLE ROW LEVEL SECURITY;

-- Users can view notifications for their own API keys
CREATE POLICY "Users can view own api_key notifications"
  ON public.api_key_usage_notifications
  FOR SELECT
  USING (
    api_key_id IN (
      SELECT id FROM public.api_keys WHERE user_id = auth.uid()
    )
  );

-- System can insert notifications (no user check needed)
CREATE POLICY "System can insert notifications"
  ON public.api_key_usage_notifications
  FOR INSERT
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.api_key_usage_notifications IS 'Tracks webhook notifications sent for API key usage thresholds';
COMMENT ON COLUMN public.api_key_usage_notifications.threshold_percentage IS 'Percentage threshold that triggered notification (80, 90, 100)';
COMMENT ON COLUMN public.api_key_usage_notifications.window_reset_at IS 'When the rate limit window resets';
