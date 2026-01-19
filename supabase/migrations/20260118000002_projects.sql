-- =========================
-- DB-002: Projects Table Migration
-- =========================
-- Creates/updates projects table for video projects with:
-- - FK to auth.users (via user_id)
-- - All required columns per PRD
-- - RLS policies
-- - Proper indexes
-- - CHECK constraints

-- Note: Projects table may already exist from initial schema migration
-- This migration ensures all PRD-required columns are present

-- =========================
-- Ensure projects table exists
-- =========================
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Project',
  niche_preset TEXT NOT NULL,
  target_minutes INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- Add missing columns (idempotent)
-- =========================

-- Add prompt_text column (required for user prompt input)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS prompt_text TEXT;

-- Add voice_profile_id column (optional reference to custom voice)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS voice_profile_id UUID REFERENCES public.voice_profiles(id) ON DELETE SET NULL;

-- Add transcript_mode column (auto or manual)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS transcript_mode TEXT DEFAULT 'auto';

-- Add transcript_text column (for manual transcripts)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS transcript_text TEXT;

-- Add settings/options column
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

-- Add template_id for backward compatibility (some migrations reference this)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS template_id TEXT DEFAULT 'minimal';

-- Add status column if not exists
DO $$
BEGIN
  -- Create project_status enum if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
    CREATE TYPE public.project_status AS ENUM ('draft', 'generating', 'ready', 'failed');
  END IF;
END $$;

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS status public.project_status DEFAULT 'draft';

-- =========================
-- Add/Update CHECK constraints
-- =========================

-- Drop existing constraint if it exists and recreate
DO $$
BEGIN
  -- Drop old niche_preset constraint if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'projects_niche_preset_check'
    AND table_name = 'projects'
  ) THEN
    ALTER TABLE public.projects DROP CONSTRAINT projects_niche_preset_check;
  END IF;

  -- Add CHECK constraint for niche_preset
  ALTER TABLE public.projects ADD CONSTRAINT projects_niche_preset_check
    CHECK (niche_preset IN ('motivation', 'explainer', 'facts', 'history', 'finance', 'science'));

  -- Drop old target_minutes constraint if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'projects_target_minutes_check'
    AND table_name = 'projects'
  ) THEN
    ALTER TABLE public.projects DROP CONSTRAINT projects_target_minutes_check;
  END IF;

  -- Add CHECK constraint for target_minutes (1-10 range)
  ALTER TABLE public.projects ADD CONSTRAINT projects_target_minutes_check
    CHECK (target_minutes BETWEEN 1 AND 10);

  -- Drop old transcript_mode constraint if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'projects_transcript_mode_check'
    AND table_name = 'projects'
  ) THEN
    ALTER TABLE public.projects DROP CONSTRAINT projects_transcript_mode_check;
  END IF;

  -- Add CHECK constraint for transcript_mode
  ALTER TABLE public.projects ADD CONSTRAINT projects_transcript_mode_check
    CHECK (transcript_mode IN ('auto', 'manual'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =========================
-- Indexes for performance
-- =========================

-- Index on user_id for fast user project queries
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);

-- Index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at DESC);

-- Index on status for filtering
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);

-- =========================
-- Trigger for updated_at
-- =========================

-- Ensure the set_updated_at function exists
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Drop old trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- RLS Policies
-- =========================

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid duplicates
DROP POLICY IF EXISTS "projects_select_own" ON public.projects;
DROP POLICY IF EXISTS "projects_insert_own" ON public.projects;
DROP POLICY IF EXISTS "projects_update_own" ON public.projects;
DROP POLICY IF EXISTS "projects_delete_own" ON public.projects;
DROP POLICY IF EXISTS "projects_service_role" ON public.projects;

-- Users can view their own projects
CREATE POLICY "projects_select_own"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create projects for themselves
CREATE POLICY "projects_insert_own"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own projects
CREATE POLICY "projects_update_own"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own projects
CREATE POLICY "projects_delete_own"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can do anything (for API and worker)
CREATE POLICY "projects_service_role"
  ON public.projects FOR ALL
  USING (auth.role() = 'service_role');

-- =========================
-- Add table comments
-- =========================

COMMENT ON TABLE public.projects IS 'Video project configurations with prompts and settings';
COMMENT ON COLUMN public.projects.user_id IS 'FK to auth.users - project owner';
COMMENT ON COLUMN public.projects.title IS 'User-provided project title';
COMMENT ON COLUMN public.projects.prompt_text IS 'User prompt for video generation';
COMMENT ON COLUMN public.projects.niche_preset IS 'Content niche/category for script generation';
COMMENT ON COLUMN public.projects.target_minutes IS 'Target video duration in minutes (1-10)';
COMMENT ON COLUMN public.projects.voice_profile_id IS 'Optional custom voice profile reference';
COMMENT ON COLUMN public.projects.transcript_mode IS 'auto (AI-generated) or manual (user-provided)';
COMMENT ON COLUMN public.projects.transcript_text IS 'Manual transcript text if transcript_mode=manual';
COMMENT ON COLUMN public.projects.settings IS 'Additional project configuration options';
COMMENT ON COLUMN public.projects.status IS 'Current project status';
