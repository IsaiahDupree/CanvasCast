-- Migration: Job Costs Tracking (ANALYTICS-004)
--
-- Purpose: Track API costs per job for cost analysis and optimization
--
-- Tables:
--   1. job_costs: Track individual API costs per job
--
-- Features:
--   - Store costs broken down by service (OpenAI, Gemini, Storage, etc.)
--   - Track operation type (completion, TTS, whisper, image gen, etc.)
--   - Store metadata for detailed cost analysis
--   - Link to jobs table for cost attribution
--
-- Security:
--   - RLS enabled (admin access only)
--   - Indexes for efficient querying by job_id and service

-- ============================================
-- JOB COSTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.job_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Service and operation info
  service text NOT NULL, -- 'openai', 'gemini', 'storage', etc.
  operation text NOT NULL, -- 'completion', 'tts', 'whisper', 'image', 'upload', etc.

  -- Cost details
  cost_usd numeric(10, 6) NOT NULL, -- Cost in USD with 6 decimal places

  -- Metadata (JSON)
  meta jsonb DEFAULT '{}'::jsonb, -- Store additional info like model, tokens, characters, etc.

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

-- Index for fast lookup by job_id
CREATE INDEX idx_job_costs_job_id ON public.job_costs(job_id);

-- Index for fast lookup by user_id
CREATE INDEX idx_job_costs_user_id ON public.job_costs(user_id);

-- Index for aggregating by service
CREATE INDEX idx_job_costs_service ON public.job_costs(service);

-- Index for time-based queries
CREATE INDEX idx_job_costs_created_at ON public.job_costs(created_at DESC);

-- Composite index for user + created_at queries
CREATE INDEX idx_job_costs_user_created ON public.job_costs(user_id, created_at DESC);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE public.job_costs ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do anything
CREATE POLICY "Service role has full access to job_costs"
  ON public.job_costs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Users can view their own job costs
CREATE POLICY "Users can view their own job costs"
  ON public.job_costs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Admins can view all job costs (will be added after is_admin column exists)
-- This policy will be created in migration 20260120000007 or later
-- CREATE POLICY "Admins can view all job costs"
--   ON public.job_costs
--   FOR SELECT
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM public.profiles
--       WHERE profiles.id = auth.uid()
--       AND profiles.is_admin = true
--     )
--   );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get total cost for a job
CREATE OR REPLACE FUNCTION public.get_job_total_cost(p_job_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total numeric;
BEGIN
  SELECT COALESCE(SUM(cost_usd), 0)
  INTO v_total
  FROM public.job_costs
  WHERE job_id = p_job_id;

  RETURN v_total;
END;
$$;

-- Function to get cost breakdown by service for a job
CREATE OR REPLACE FUNCTION public.get_job_cost_breakdown(p_job_id uuid)
RETURNS TABLE(service text, total_cost numeric, operation_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    jc.service,
    COALESCE(SUM(jc.cost_usd), 0) as total_cost,
    COUNT(*) as operation_count
  FROM public.job_costs jc
  WHERE jc.job_id = p_job_id
  GROUP BY jc.service
  ORDER BY total_cost DESC;
END;
$$;

-- Function to get user's total spend over time period
CREATE OR REPLACE FUNCTION public.get_user_spend(
  p_user_id uuid,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total numeric;
BEGIN
  SELECT COALESCE(SUM(cost_usd), 0)
  INTO v_total
  FROM public.job_costs
  WHERE user_id = p_user_id
    AND (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date);

  RETURN v_total;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_job_total_cost(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_job_cost_breakdown(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_spend(uuid, timestamptz, timestamptz) TO authenticated, service_role;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE public.job_costs IS 'Tracks API costs per job for cost analysis and optimization (ANALYTICS-004)';
COMMENT ON COLUMN public.job_costs.service IS 'Service name (openai, gemini, storage, etc.)';
COMMENT ON COLUMN public.job_costs.operation IS 'Operation type (completion, tts, whisper, image, upload, etc.)';
COMMENT ON COLUMN public.job_costs.cost_usd IS 'Cost in USD with 6 decimal places for precision';
COMMENT ON COLUMN public.job_costs.meta IS 'JSON metadata (model, tokens, characters, file size, etc.)';
