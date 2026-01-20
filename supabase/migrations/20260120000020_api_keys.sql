/**
 * API Keys Table Migration
 * Feature: RATE-004
 *
 * Creates the api_keys table for API key-based authentication and rate limiting.
 * Includes per-key rate limits, usage tracking, and expiration support.
 */

-- Create api_keys table
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,

  -- Rate limiting configuration
  rate_limit_requests INTEGER NOT NULL DEFAULT 100,
  rate_limit_window TEXT NOT NULL DEFAULT '1h', -- e.g., '1m', '1h', '1d'

  -- Usage tracking
  usage_count BIGINT NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Status and expiration
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index on user_id for efficient lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);

-- Create index on key for fast authentication
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON public.api_keys(key);

-- Create index on is_active for filtering
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON public.api_keys(is_active) WHERE is_active = true;

-- Add RLS policies
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Users can view their own API keys
CREATE POLICY "Users can view own api_keys"
  ON public.api_keys
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own API keys
CREATE POLICY "Users can create own api_keys"
  ON public.api_keys
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own API keys
CREATE POLICY "Users can update own api_keys"
  ON public.api_keys
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own API keys
CREATE POLICY "Users can delete own api_keys"
  ON public.api_keys
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.update_api_keys_updated_at();

-- Add comment
COMMENT ON TABLE public.api_keys IS 'API keys for programmatic access with per-key rate limiting';
COMMENT ON COLUMN public.api_keys.key IS 'Hashed API key (never store plaintext)';
COMMENT ON COLUMN public.api_keys.rate_limit_requests IS 'Number of requests allowed per window';
COMMENT ON COLUMN public.api_keys.rate_limit_window IS 'Time window for rate limit (e.g., 1m, 1h, 1d)';
COMMENT ON COLUMN public.api_keys.usage_count IS 'Total number of requests made with this key';
