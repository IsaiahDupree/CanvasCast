-- =========================
-- RESIL-001: Add checkpoint state to jobs table
-- =========================
-- Adds checkpoint_state column to jobs table to enable partial asset recovery
-- Allows users to retry from last successful step if image gen succeeds but rendering fails

-- Add checkpoint_state column
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS checkpoint_state JSONB;

-- Add index for checking checkpoint existence
CREATE INDEX IF NOT EXISTS idx_jobs_checkpoint_state ON public.jobs(id) WHERE checkpoint_state IS NOT NULL;

-- Add updated_at column if it doesn't exist (for tracking checkpoint saves)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_jobs_updated_at ON public.jobs;

CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON public.jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='checkpoint_state') THEN
    EXECUTE 'COMMENT ON COLUMN public.jobs.checkpoint_state IS ''Checkpoint state for partial recovery - stores last completed step and artifacts''';
  END IF;
END $$;
