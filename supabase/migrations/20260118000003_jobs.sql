-- =========================
-- DB-003: Jobs Table Migration
-- =========================
-- Creates jobs table for video generation job tracking with:
-- - job_status enum with all pipeline states
-- - Progress tracking (0-100)
-- - FK to projects and users
-- - Cost/credit tracking
-- - Error tracking for failed jobs
-- - Output URL and manifest storage
-- - Proper indexes
-- - RLS policies

-- =========================
-- Create job_status enum
-- =========================
DO $$
BEGIN
  -- Create job_status enum if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
    CREATE TYPE public.job_status AS ENUM (
      'PENDING',
      'QUEUED',
      'SCRIPTING',
      'VOICE_GEN',
      'ALIGNMENT',
      'VISUAL_PLAN',
      'IMAGE_GEN',
      'TIMELINE',
      'RENDERING',
      'PACKAGING',
      'READY',
      'FAILED'
    );
  END IF;
END $$;

-- =========================
-- Ensure jobs table exists
-- =========================
-- Note: Jobs table may already exist from earlier migrations
-- This ensures all required columns per PRD are present

CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.job_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- Add missing columns (idempotent)
-- =========================

-- Add progress column (0-100 percentage)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='jobs' AND column_name='progress') THEN
    ALTER TABLE public.jobs ADD COLUMN progress INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add progress check constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'jobs_progress_check' AND table_name = 'jobs'
  ) THEN
    ALTER TABLE public.jobs ADD CONSTRAINT jobs_progress_check
      CHECK (progress BETWEEN 0 AND 100);
  END IF;
END $$;

-- Add status_message column
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS status_message TEXT;

-- Add cost tracking columns
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS cost_credits_reserved INTEGER DEFAULT 0;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS cost_credits_final INTEGER;

-- Add error tracking columns
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS failed_step TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS error_code TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Add output columns
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS output_url TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS manifest_json JSONB;

-- Add timestamp columns (may already exist from earlier migration)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

-- =========================
-- Create indexes for performance
-- =========================

-- Index on user_id for user's job queries
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);

-- Index on project_id for project's jobs
CREATE INDEX IF NOT EXISTS idx_jobs_project_id ON public.jobs(project_id);

-- Index on status for filtering by status
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);

-- Index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs(created_at DESC);

-- =========================
-- RLS Policies
-- =========================

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid duplicates
DROP POLICY IF EXISTS "jobs_select_own" ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert_own" ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_own" ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete_own" ON public.jobs;
DROP POLICY IF EXISTS "jobs_service_role" ON public.jobs;

-- Users can view their own jobs
CREATE POLICY "jobs_select_own"
  ON public.jobs FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create jobs for themselves
CREATE POLICY "jobs_insert_own"
  ON public.jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own jobs (though typically done by worker)
CREATE POLICY "jobs_update_own"
  ON public.jobs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own jobs
CREATE POLICY "jobs_delete_own"
  ON public.jobs FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can do anything (for API and worker)
CREATE POLICY "jobs_service_role"
  ON public.jobs FOR ALL
  USING (auth.role() = 'service_role');

-- =========================
-- Add table and column comments
-- =========================

DO $$
BEGIN
  EXECUTE 'COMMENT ON TABLE public.jobs IS ''Video generation job tracking with status, progress, and results''';

  -- Only add comments if columns exist
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='project_id') THEN
    EXECUTE 'COMMENT ON COLUMN public.jobs.project_id IS ''FK to projects - the project this job is generating''';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='user_id') THEN
    EXECUTE 'COMMENT ON COLUMN public.jobs.user_id IS ''FK to auth.users - job owner''';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='status') THEN
    EXECUTE 'COMMENT ON COLUMN public.jobs.status IS ''Current job status (PENDING → QUEUED → pipeline steps → READY/FAILED)''';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='progress') THEN
    EXECUTE 'COMMENT ON COLUMN public.jobs.progress IS ''Job progress percentage (0-100)''';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='status_message') THEN
    EXECUTE 'COMMENT ON COLUMN public.jobs.status_message IS ''Human-readable status message''';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='cost_credits_reserved') THEN
    EXECUTE 'COMMENT ON COLUMN public.jobs.cost_credits_reserved IS ''Credits reserved at job start''';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='cost_credits_final') THEN
    EXECUTE 'COMMENT ON COLUMN public.jobs.cost_credits_final IS ''Final credits charged after completion''';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='failed_step') THEN
    EXECUTE 'COMMENT ON COLUMN public.jobs.failed_step IS ''Pipeline step where job failed (if status=FAILED)''';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='error_code') THEN
    EXECUTE 'COMMENT ON COLUMN public.jobs.error_code IS ''Error code for failed jobs''';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='error_message') THEN
    EXECUTE 'COMMENT ON COLUMN public.jobs.error_message IS ''Detailed error message for failed jobs''';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='output_url') THEN
    EXECUTE 'COMMENT ON COLUMN public.jobs.output_url IS ''Public URL of generated video (when status=READY)''';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='manifest_json') THEN
    EXECUTE 'COMMENT ON COLUMN public.jobs.manifest_json IS ''JSON manifest of all generated assets and metadata''';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='created_at') THEN
    EXECUTE 'COMMENT ON COLUMN public.jobs.created_at IS ''When job was created''';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='started_at') THEN
    EXECUTE 'COMMENT ON COLUMN public.jobs.started_at IS ''When job processing started''';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='finished_at') THEN
    EXECUTE 'COMMENT ON COLUMN public.jobs.finished_at IS ''When job finished (success or failure)''';
  END IF;
END $$;
