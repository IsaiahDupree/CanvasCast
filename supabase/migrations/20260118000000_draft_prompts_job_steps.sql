-- Migration: Add draft_prompts table for pre-auth flow and job_steps for detailed tracking
-- Per PRD: Users can submit prompts before signing up, then restore after auth

-- ============================================================================
-- DRAFT PROMPTS (Pre-auth flow)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.draft_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  template_id TEXT DEFAULT 'narrated_storyboard_v1',
  options_json JSONB DEFAULT '{}',
  claimed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by session token
CREATE INDEX IF NOT EXISTS idx_draft_prompts_session_token ON public.draft_prompts(session_token);
CREATE INDEX IF NOT EXISTS idx_draft_prompts_expires_at ON public.draft_prompts(expires_at);

-- RLS for draft_prompts (public can create, only owner can read after claim)
ALTER TABLE public.draft_prompts ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a draft (pre-auth)
CREATE POLICY "Anyone can create drafts" ON public.draft_prompts
  FOR INSERT WITH CHECK (true);

-- Users can read their own claimed drafts
CREATE POLICY "Users can read own claimed drafts" ON public.draft_prompts
  FOR SELECT USING (
    claimed_by_user_id = auth.uid() OR
    claimed_by_user_id IS NULL
  );

-- Users can update drafts they've claimed
CREATE POLICY "Users can update own drafts" ON public.draft_prompts
  FOR UPDATE USING (claimed_by_user_id = auth.uid());

-- ============================================================================
-- JOB STEPS (Detailed progress tracking)
-- ============================================================================

-- New job states enum per PRD
DO $$
BEGIN
  -- Drop old enum if exists and recreate with new states
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
    -- Add new values to existing enum
    ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'queued';
    ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'scripting';
    ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'scene_planning';
    ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'image_gen';
    ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'voice_gen';
    ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'alignment';
    ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'rendering';
    ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'packaging';
    ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'ready';
    ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'failed';
  END IF;
END$$;

-- Step status enum
CREATE TYPE IF NOT EXISTS step_status AS ENUM ('pending', 'started', 'succeeded', 'failed', 'skipped');

-- Job steps table for granular progress tracking
CREATE TABLE IF NOT EXISTS public.job_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  step_order INT NOT NULL,
  state step_status DEFAULT 'pending',
  progress_pct INT DEFAULT 0 CHECK (progress_pct >= 0 AND progress_pct <= 100),
  status_message TEXT,
  error_message TEXT,
  logs_url TEXT,
  artifacts_json JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by job
CREATE INDEX IF NOT EXISTS idx_job_steps_job_id ON public.job_steps(job_id);

-- RLS for job_steps
ALTER TABLE public.job_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own job steps" ON public.job_steps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.jobs WHERE jobs.id = job_steps.job_id AND jobs.user_id = auth.uid()
    )
  );

-- Service role can do anything
CREATE POLICY "Service role full access to job_steps" ON public.job_steps
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- UPDATE JOBS TABLE
-- ============================================================================

-- Add new columns to jobs table for PRD compliance
ALTER TABLE public.jobs 
  ADD COLUMN IF NOT EXISTS progress_pct INT DEFAULT 0 CHECK (progress_pct >= 0 AND progress_pct <= 100),
  ADD COLUMN IF NOT EXISTS status_message TEXT,
  ADD COLUMN IF NOT EXISTS failed_step TEXT,
  ADD COLUMN IF NOT EXISTS error_json JSONB,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

-- ============================================================================
-- UPDATE PROJECTS TABLE
-- ============================================================================

-- Add new columns to projects for PRD compliance
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS prompt_text TEXT,
  ADD COLUMN IF NOT EXISTS transcript_text TEXT,
  ADD COLUMN IF NOT EXISTS transcript_mode TEXT DEFAULT 'auto' CHECK (transcript_mode IN ('auto', 'manual')),
  ADD COLUMN IF NOT EXISTS template_id TEXT DEFAULT 'narrated_storyboard_v1',
  ADD COLUMN IF NOT EXISTS options_json JSONB DEFAULT '{}';

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to claim a draft prompt after user signs up
CREATE OR REPLACE FUNCTION public.claim_draft_prompt(
  p_session_token TEXT,
  p_user_id UUID
) RETURNS UUID AS $$
DECLARE
  v_draft_id UUID;
BEGIN
  UPDATE public.draft_prompts
  SET 
    claimed_by_user_id = p_user_id,
    updated_at = NOW()
  WHERE 
    session_token = p_session_token 
    AND claimed_by_user_id IS NULL
    AND expires_at > NOW()
  RETURNING id INTO v_draft_id;
  
  RETURN v_draft_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create job steps for a new job
CREATE OR REPLACE FUNCTION public.create_job_steps(p_job_id UUID) RETURNS VOID AS $$
BEGIN
  INSERT INTO public.job_steps (job_id, step_name, step_order) VALUES
    (p_job_id, 'queued', 1),
    (p_job_id, 'scripting', 2),
    (p_job_id, 'scene_planning', 3),
    (p_job_id, 'image_gen', 4),
    (p_job_id, 'voice_gen', 5),
    (p_job_id, 'alignment', 6),
    (p_job_id, 'rendering', 7),
    (p_job_id, 'packaging', 8),
    (p_job_id, 'ready', 9);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update job step status
CREATE OR REPLACE FUNCTION public.update_job_step(
  p_job_id UUID,
  p_step_name TEXT,
  p_state step_status,
  p_progress_pct INT DEFAULT NULL,
  p_status_message TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE public.job_steps
  SET 
    state = p_state,
    progress_pct = COALESCE(p_progress_pct, progress_pct),
    status_message = COALESCE(p_status_message, status_message),
    error_message = p_error_message,
    started_at = CASE WHEN p_state = 'started' AND started_at IS NULL THEN NOW() ELSE started_at END,
    finished_at = CASE WHEN p_state IN ('succeeded', 'failed', 'skipped') THEN NOW() ELSE finished_at END
  WHERE job_id = p_job_id AND step_name = p_step_name;
  
  -- Also update the main job record
  UPDATE public.jobs
  SET 
    status = p_step_name::job_status,
    progress_pct = COALESCE(p_progress_pct, progress_pct),
    status_message = COALESCE(p_status_message, status_message),
    failed_step = CASE WHEN p_state = 'failed' THEN p_step_name ELSE failed_step END,
    error_json = CASE WHEN p_error_message IS NOT NULL THEN jsonb_build_object('message', p_error_message, 'step', p_step_name) ELSE error_json END,
    started_at = CASE WHEN p_step_name = 'scripting' AND started_at IS NULL THEN NOW() ELSE started_at END,
    finished_at = CASE WHEN p_step_name = 'ready' OR p_state = 'failed' THEN NOW() ELSE finished_at END,
    updated_at = NOW()
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create job steps when a job is created
CREATE OR REPLACE FUNCTION public.handle_new_job() RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.create_job_steps(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_job_created ON public.jobs;
CREATE TRIGGER on_job_created
  AFTER INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_job();

-- ============================================================================
-- GRANT TRIAL CREDIT ON FIRST SIGNUP
-- ============================================================================

-- Update handle_new_user to grant 1 free trial credit (1 video render)
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, stripe_customer_id)
  VALUES (NEW.id, NULL)
  ON CONFLICT (id) DO NOTHING;
  
  -- Grant trial credit (1 free video = ~10 minutes worth)
  INSERT INTO public.credit_ledger (user_id, type, amount, note)
  VALUES (NEW.id, 'purchase', 10, 'Welcome bonus: 1 free video trial');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CLEANUP EXPIRED DRAFTS (run via cron or scheduled function)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_drafts() RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM public.draft_prompts
  WHERE expires_at < NOW() AND claimed_by_user_id IS NULL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
