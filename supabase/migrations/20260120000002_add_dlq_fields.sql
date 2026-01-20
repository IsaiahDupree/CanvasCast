-- =========================
-- RESIL-003: Dead Letter Queue Fields
-- =========================
-- Adds retry_count, dlq_at, and dlq_reason columns to jobs table
-- for tracking failed jobs that exceed retry limits

-- Add retry_count column (defaults to 0)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Add constraint to ensure retry_count is non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'jobs_retry_count_check' AND table_name = 'jobs'
  ) THEN
    ALTER TABLE public.jobs ADD CONSTRAINT jobs_retry_count_check
      CHECK (retry_count >= 0);
  END IF;
END $$;

-- Add dlq_at column (timestamp when job was moved to DLQ)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS dlq_at TIMESTAMPTZ;

-- Add dlq_reason column (reason for DLQ placement)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS dlq_reason TEXT;

-- Create index on dlq_at for filtering DLQ jobs
CREATE INDEX IF NOT EXISTS idx_jobs_dlq_at ON public.jobs(dlq_at) WHERE dlq_at IS NOT NULL;

-- Create index on retry_count for monitoring
CREATE INDEX IF NOT EXISTS idx_jobs_retry_count ON public.jobs(retry_count) WHERE retry_count > 0;

-- =========================
-- Add column comments
-- =========================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='retry_count') THEN
    EXECUTE 'COMMENT ON COLUMN public.jobs.retry_count IS ''Number of times job has been retried after failure''';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='dlq_at') THEN
    EXECUTE 'COMMENT ON COLUMN public.jobs.dlq_at IS ''Timestamp when job was moved to dead letter queue (null if not in DLQ)''';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='dlq_reason') THEN
    EXECUTE 'COMMENT ON COLUMN public.jobs.dlq_reason IS ''Reason job was moved to dead letter queue''';
  END IF;
END $$;
