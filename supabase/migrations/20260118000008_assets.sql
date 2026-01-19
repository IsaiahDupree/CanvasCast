-- =========================
-- DB-008: Assets Table Migration
-- =========================
-- Updates assets table to align with PRD spec:
-- - Updates asset_type enum to include 'manifest'
-- - Adds missing columns: url, storage_path, size_bytes, mime_type
-- - Updates FK to make job_id NOT NULL with CASCADE delete
-- - Renames columns: path -> storage_path, meta -> metadata_json
-- - Proper indexes
-- - RLS policies

-- =========================
-- Ensure assets table exists
-- =========================
-- Note: Assets table already exists from initial_schema.sql
-- This migration ensures it has all required columns per PRD

CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- Update asset_type enum to include 'manifest'
-- =========================

DO $$
BEGIN
  -- Add 'manifest' to existing asset_type enum if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'asset_type' AND e.enumlabel = 'manifest'
  ) THEN
    ALTER TYPE public.asset_type ADD VALUE 'manifest';
  END IF;
END $$;

-- =========================
-- Migrate from enum to text type with constraint
-- =========================

-- If type column is using enum, convert to TEXT with CHECK constraint
DO $$
BEGIN
  -- Check if type column exists and is using the enum
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'type'
  ) THEN
    -- Alter type from enum to TEXT
    ALTER TABLE public.assets ALTER COLUMN type TYPE TEXT;
  END IF;
END $$;

-- Add CHECK constraint for asset types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'assets_type_check' AND table_name = 'assets'
  ) THEN
    ALTER TABLE public.assets ADD CONSTRAINT assets_type_check
      CHECK (type IN ('video', 'audio', 'image', 'captions', 'manifest', 'zip', 'script', 'timeline', 'outline', 'other'));
  END IF;
END $$;

-- =========================
-- Add missing columns (idempotent)
-- =========================

-- Add url column (public URL for the asset)
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS url TEXT;

-- Add storage_path column (or rename from path if it exists)
DO $$
BEGIN
  -- If 'path' column exists and 'storage_path' doesn't, rename it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'path'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'storage_path'
  ) THEN
    ALTER TABLE public.assets RENAME COLUMN path TO storage_path;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'storage_path'
  ) THEN
    ALTER TABLE public.assets ADD COLUMN storage_path TEXT;
  END IF;
END $$;

-- Add size_bytes column
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS size_bytes BIGINT;

-- Add mime_type column
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- Add metadata_json column (or rename from meta if it exists)
DO $$
BEGIN
  -- If 'meta' column exists and 'metadata_json' doesn't, rename it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'meta'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'metadata_json'
  ) THEN
    ALTER TABLE public.assets RENAME COLUMN meta TO metadata_json;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'metadata_json'
  ) THEN
    ALTER TABLE public.assets ADD COLUMN metadata_json JSONB DEFAULT '{}';
  END IF;
END $$;

-- Make job_id NOT NULL (after backfilling if needed)
DO $$
BEGIN
  -- Only make NOT NULL if all rows have job_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'job_id' AND is_nullable = 'NO'
  ) THEN
    -- First, ensure url and storage_path have defaults for existing rows
    UPDATE public.assets SET url = COALESCE(url, '') WHERE url IS NULL;
    UPDATE public.assets SET storage_path = COALESCE(storage_path, '') WHERE storage_path IS NULL;

    -- Make job_id NOT NULL if it's safe to do so
    -- (Skip if any rows have NULL job_id)
    IF NOT EXISTS (SELECT 1 FROM public.assets WHERE job_id IS NULL) THEN
      ALTER TABLE public.assets ALTER COLUMN job_id SET NOT NULL;
    END IF;
  END IF;
END $$;

-- Update FK constraint on job_id to CASCADE on delete
DO $$
BEGIN
  -- Drop old FK constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'assets_job_id_fkey' AND table_name = 'assets'
  ) THEN
    ALTER TABLE public.assets DROP CONSTRAINT assets_job_id_fkey;
    ALTER TABLE public.assets ADD CONSTRAINT assets_job_id_fkey
      FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;
  END IF;
END $$;

-- =========================
-- Create indexes for performance
-- =========================

-- Index on job_id for job's assets queries
CREATE INDEX IF NOT EXISTS idx_assets_job_id ON public.assets(job_id);

-- Index on type for filtering by asset type
CREATE INDEX IF NOT EXISTS idx_assets_type ON public.assets(type);

-- =========================
-- RLS Policies
-- =========================

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid duplicates
DROP POLICY IF EXISTS "assets_select_own" ON public.assets;
DROP POLICY IF EXISTS "assets_insert_own" ON public.assets;
DROP POLICY IF EXISTS "assets_update_own" ON public.assets;
DROP POLICY IF EXISTS "assets_delete_own" ON public.assets;
DROP POLICY IF EXISTS "assets_service_role" ON public.assets;

-- Users can view assets from their own jobs
CREATE POLICY "assets_select_own"
  ON public.assets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = assets.job_id
        AND jobs.user_id = auth.uid()
    )
  );

-- Users can create assets for their own jobs (though typically done by worker)
CREATE POLICY "assets_insert_own"
  ON public.assets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = assets.job_id
        AND jobs.user_id = auth.uid()
    )
  );

-- Users can update assets from their own jobs
CREATE POLICY "assets_update_own"
  ON public.assets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = assets.job_id
        AND jobs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = assets.job_id
        AND jobs.user_id = auth.uid()
    )
  );

-- Users can delete assets from their own jobs
CREATE POLICY "assets_delete_own"
  ON public.assets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = assets.job_id
        AND jobs.user_id = auth.uid()
    )
  );

-- Service role can do anything (for API and worker)
CREATE POLICY "assets_service_role"
  ON public.assets FOR ALL
  USING (auth.role() = 'service_role');

-- =========================
-- Add table and column comments
-- =========================

DO $$
BEGIN
  EXECUTE 'COMMENT ON TABLE public.assets IS ''Generated asset tracking for video production pipeline''';

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='job_id') THEN
    EXECUTE 'COMMENT ON COLUMN public.assets.job_id IS ''FK to jobs - the job that generated this asset''';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='type') THEN
    EXECUTE 'COMMENT ON COLUMN public.assets.type IS ''Asset type: video, audio, image, captions, manifest, or zip''';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='url') THEN
    EXECUTE 'COMMENT ON COLUMN public.assets.url IS ''Public URL for accessing the asset''';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='storage_path') THEN
    EXECUTE 'COMMENT ON COLUMN public.assets.storage_path IS ''Internal storage path in Supabase Storage''';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='size_bytes') THEN
    EXECUTE 'COMMENT ON COLUMN public.assets.size_bytes IS ''File size in bytes''';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='mime_type') THEN
    EXECUTE 'COMMENT ON COLUMN public.assets.mime_type IS ''MIME type of the asset (e.g., video/mp4, image/png)''';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='metadata_json') THEN
    EXECUTE 'COMMENT ON COLUMN public.assets.metadata_json IS ''Additional metadata about the asset (dimensions, duration, etc.)''';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='created_at') THEN
    EXECUTE 'COMMENT ON COLUMN public.assets.created_at IS ''When the asset was created''';
  END IF;
END $$;
