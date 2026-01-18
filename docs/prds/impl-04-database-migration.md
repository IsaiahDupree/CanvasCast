# Implementation PRD: Database Schema Migration

**Type:** Implementation Guide  
**Priority:** P0  
**Status:** Ready for Implementation  

---

## 1. Overview

This document details the database migrations needed to transform BlankLogo's schema into CanvasCast's schema, specifying what to keep, modify, and add.

---

## 2. Migration Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      DATABASE MIGRATION                                  │
│                                                                         │
│  KEEP (from BlankLogo)          MODIFY                ADD NEW           │
│  ─────────────────────────────────────────────────────────────────────  │
│  • auth.users (Supabase)        • profiles table      • draft_prompts   │
│  • profiles table               • credit_ledger       • projects        │
│  • credit_ledger table            (add job_id)        • jobs            │
│                                                       • job_steps       │
│                                                       • assets          │
│                                                       • voice_profiles  │
│                                                       • RPC functions   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. KEEP: Existing Migrations

### These BlankLogo migrations can be kept as-is:
```
supabase/migrations/
├── 20240101000000_initial.sql       ← KEEP: Supabase setup
├── 20240102000000_profiles.sql      ← KEEP (will modify)
└── 20240103000000_credits.sql       ← KEEP (will modify)
```

---

## 4. MODIFY: Profiles Table

### FROM (BlankLogo):
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### TO (CanvasCast):
```sql
-- Migration: 20260118000001_modify_profiles.sql

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{
  "job_complete": true,
  "job_failed": true,
  "low_credits": true,
  "marketing": false
}'::jsonb;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add index for Stripe lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe 
ON profiles(stripe_customer_id) 
WHERE stripe_customer_id IS NOT NULL;
```

---

## 5. MODIFY: Credit Ledger

### FROM (BlankLogo):
```sql
CREATE TABLE credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### TO (CanvasCast):
```sql
-- Migration: 20260118000002_modify_credits.sql

-- Add job_id for tracking credits per job
ALTER TABLE credit_ledger 
ADD COLUMN IF NOT EXISTS job_id UUID;

-- Add Stripe reference
ALTER TABLE credit_ledger 
ADD COLUMN IF NOT EXISTS stripe_payment_id TEXT;

-- Add balance_after for audit
ALTER TABLE credit_ledger 
ADD COLUMN IF NOT EXISTS balance_after INTEGER;

-- Add constraint for valid types
ALTER TABLE credit_ledger 
DROP CONSTRAINT IF EXISTS credit_ledger_type_check;

ALTER TABLE credit_ledger 
ADD CONSTRAINT credit_ledger_type_check 
CHECK (type IN ('purchase', 'usage', 'refund', 'grant', 'expire', 'reserve', 'subscription'));

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_credit_job ON credit_ledger(job_id);
CREATE INDEX IF NOT EXISTS idx_credit_stripe ON credit_ledger(stripe_payment_id);
```

---

## 6. ADD: Draft Prompts Table

```sql
-- Migration: 20260118000003_draft_prompts.sql

CREATE TABLE draft_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  template_id TEXT,
  options JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

-- Indexes
CREATE INDEX idx_draft_session ON draft_prompts(session_token);
CREATE INDEX idx_draft_user ON draft_prompts(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_draft_expires ON draft_prompts(expires_at);

-- RLS
ALTER TABLE draft_prompts ENABLE ROW LEVEL SECURITY;

-- Anyone can create a draft (for pre-auth)
CREATE POLICY draft_insert ON draft_prompts
  FOR INSERT WITH CHECK (true);

-- Users can read their own drafts
CREATE POLICY draft_select ON draft_prompts
  FOR SELECT USING (
    user_id = auth.uid() OR 
    session_token = current_setting('app.session_token', true)
  );

-- Users can update their own drafts
CREATE POLICY draft_update ON draft_prompts
  FOR UPDATE USING (
    user_id = auth.uid() OR 
    (user_id IS NULL AND session_token = current_setting('app.session_token', true))
  );
```

---

## 7. ADD: Projects Table

```sql
-- Migration: 20260118000004_projects.sql

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  niche_preset TEXT NOT NULL,
  target_minutes INTEGER NOT NULL DEFAULT 1,
  voice_profile_id UUID,
  transcript_mode TEXT DEFAULT 'auto',
  transcript_text TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT projects_niche_check CHECK (
    niche_preset IN ('motivation', 'explainer', 'facts', 'history', 'finance', 'science')
  ),
  CONSTRAINT projects_minutes_check CHECK (
    target_minutes BETWEEN 1 AND 10
  ),
  CONSTRAINT projects_transcript_mode_check CHECK (
    transcript_mode IN ('auto', 'manual')
  )
);

-- Indexes
CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_projects_created ON projects(created_at DESC);

-- RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY projects_all ON projects
  USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

---

## 8. ADD: Jobs Table

```sql
-- Migration: 20260118000005_jobs.sql

-- Create enum for job status
CREATE TYPE job_status AS ENUM (
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

CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status job_status NOT NULL DEFAULT 'PENDING',
  progress INTEGER DEFAULT 0,
  status_message TEXT,
  cost_credits_reserved INTEGER DEFAULT 0,
  cost_credits_final INTEGER,
  failed_step TEXT,
  error_code TEXT,
  error_message TEXT,
  output_url TEXT,
  manifest_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT jobs_progress_check CHECK (progress BETWEEN 0 AND 100)
);

-- Indexes
CREATE INDEX idx_jobs_user ON jobs(user_id);
CREATE INDEX idx_jobs_project ON jobs(project_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_created ON jobs(created_at DESC);

-- RLS
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY jobs_select ON jobs
  FOR SELECT USING (user_id = auth.uid());

-- Service role can update jobs
CREATE POLICY jobs_service_update ON jobs
  FOR UPDATE USING (true);

-- Add foreign key to credit_ledger
ALTER TABLE credit_ledger
  ADD CONSTRAINT credit_ledger_job_fk
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL;
```

---

## 9. ADD: Job Steps Table

```sql
-- Migration: 20260118000006_job_steps.sql

CREATE TYPE step_state AS ENUM ('pending', 'started', 'succeeded', 'failed');

CREATE TABLE job_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  state step_state DEFAULT 'pending',
  progress_pct INTEGER DEFAULT 0,
  status_message TEXT,
  error_message TEXT,
  logs_url TEXT,
  artifacts_json JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT job_steps_progress_check CHECK (progress_pct BETWEEN 0 AND 100)
);

-- Indexes
CREATE INDEX idx_job_steps_job ON job_steps(job_id);
CREATE UNIQUE INDEX idx_job_steps_unique ON job_steps(job_id, step_name);

-- RLS (inherit from jobs)
ALTER TABLE job_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_steps_select ON job_steps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM jobs WHERE jobs.id = job_steps.job_id AND jobs.user_id = auth.uid()
    )
  );
```

---

## 10. ADD: Assets Table

```sql
-- Migration: 20260118000007_assets.sql

CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes BIGINT,
  mime_type TEXT,
  metadata_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT assets_type_check CHECK (
    type IN ('video', 'audio', 'image', 'captions', 'manifest', 'zip', 'thumbnail')
  )
);

-- Indexes
CREATE INDEX idx_assets_job ON assets(job_id);
CREATE INDEX idx_assets_type ON assets(type);

-- RLS
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY assets_select ON assets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM jobs WHERE jobs.id = assets.job_id AND jobs.user_id = auth.uid()
    )
  );
```

---

## 11. ADD: Voice Profiles Table

```sql
-- Migration: 20260118000008_voice_profiles.sql

CREATE TABLE voice_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  audio_path TEXT NOT NULL,
  provider TEXT DEFAULT 'custom',
  voice_id TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_voice_profiles_user ON voice_profiles(user_id);

-- RLS
ALTER TABLE voice_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY voice_profiles_all ON voice_profiles
  USING (user_id = auth.uid());

-- Add foreign key to projects
ALTER TABLE projects
  ADD CONSTRAINT projects_voice_profile_fk
  FOREIGN KEY (voice_profile_id) REFERENCES voice_profiles(id) ON DELETE SET NULL;
```

---

## 12. ADD: RPC Functions

```sql
-- Migration: 20260118000009_rpc_functions.sql

-- Get credit balance
CREATE OR REPLACE FUNCTION get_credit_balance(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(SUM(amount), 0)::INTEGER
  FROM credit_ledger
  WHERE user_id = p_user_id;
$$;

-- Reserve credits for a job
CREATE OR REPLACE FUNCTION reserve_credits(
  p_user_id UUID,
  p_job_id UUID,
  p_amount INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  -- Get current balance
  SELECT get_credit_balance(p_user_id) INTO v_balance;
  
  -- Check if sufficient
  IF v_balance < p_amount THEN
    RETURN FALSE;
  END IF;
  
  -- Insert reservation (negative amount)
  INSERT INTO credit_ledger (user_id, type, amount, job_id, note)
  VALUES (p_user_id, 'reserve', -p_amount, p_job_id, 'Reserved for job');
  
  RETURN TRUE;
END;
$$;

-- Finalize job credits (convert reservation to usage)
CREATE OR REPLACE FUNCTION finalize_job_credits(
  p_job_id UUID,
  p_final_cost INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_reserved INTEGER;
BEGIN
  -- Get job info
  SELECT user_id, cost_credits_reserved 
  INTO v_user_id, v_reserved
  FROM jobs WHERE id = p_job_id;
  
  -- Delete reservation
  DELETE FROM credit_ledger 
  WHERE job_id = p_job_id AND type = 'reserve';
  
  -- Add final usage
  INSERT INTO credit_ledger (user_id, type, amount, job_id, note)
  VALUES (v_user_id, 'usage', -p_final_cost, p_job_id, 'Video generation');
  
  -- Refund difference if any
  IF v_reserved > p_final_cost THEN
    INSERT INTO credit_ledger (user_id, type, amount, job_id, note)
    VALUES (v_user_id, 'refund', v_reserved - p_final_cost, p_job_id, 'Unused credits refund');
  END IF;
END;
$$;

-- Release job credits (on failure)
CREATE OR REPLACE FUNCTION release_job_credits(p_job_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_reserved INTEGER;
BEGIN
  -- Get reserved amount
  SELECT user_id, ABS(amount) 
  INTO v_user_id, v_reserved
  FROM credit_ledger 
  WHERE job_id = p_job_id AND type = 'reserve'
  LIMIT 1;
  
  IF v_reserved IS NOT NULL THEN
    -- Delete reservation
    DELETE FROM credit_ledger 
    WHERE job_id = p_job_id AND type = 'reserve';
    
    -- Log the release
    INSERT INTO credit_ledger (user_id, type, amount, job_id, note)
    VALUES (v_user_id, 'refund', v_reserved, p_job_id, 'Job failed - credits released');
  END IF;
END;
$$;

-- Claim draft prompt after signup
CREATE OR REPLACE FUNCTION claim_draft_prompt(
  p_session_token TEXT,
  p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_draft_id UUID;
BEGIN
  UPDATE draft_prompts
  SET user_id = p_user_id, updated_at = NOW()
  WHERE session_token = p_session_token
    AND user_id IS NULL
    AND expires_at > NOW()
  RETURNING id INTO v_draft_id;
  
  RETURN v_draft_id;
END;
$$;

-- Add credits (for purchases, grants)
CREATE OR REPLACE FUNCTION add_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_type TEXT,
  p_note TEXT,
  p_stripe_payment_id TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO credit_ledger (user_id, type, amount, note, stripe_payment_id)
  VALUES (p_user_id, p_type, p_amount, p_note, p_stripe_payment_id);
END;
$$;
```

---

## 13. ADD: Triggers

```sql
-- Migration: 20260118000010_triggers.sql

-- Update updated_at function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- New user setup trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create profile
  INSERT INTO profiles (id, display_name)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', 'User')
  );
  
  -- Grant trial credits
  INSERT INTO credit_ledger (user_id, type, amount, note)
  VALUES (NEW.id, 'grant', 10, 'Welcome bonus: 10 trial credits');
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Draft prompts updated_at
CREATE TRIGGER draft_prompts_updated_at
  BEFORE UPDATE ON draft_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

---

## 14. Migration Order

Run migrations in this exact order:
```bash
# 1. Modify existing tables
pnpm supabase migration new modify_profiles
pnpm supabase migration new modify_credits

# 2. Add new tables (in dependency order)
pnpm supabase migration new draft_prompts
pnpm supabase migration new projects
pnpm supabase migration new jobs
pnpm supabase migration new job_steps
pnpm supabase migration new assets
pnpm supabase migration new voice_profiles

# 3. Add functions and triggers
pnpm supabase migration new rpc_functions
pnpm supabase migration new triggers

# Apply all
pnpm supabase db push
```

---

## 15. Seed Data (Development)

```sql
-- supabase/seed.sql

-- Test user (use Supabase dashboard to create)
-- Then run:

-- Test credits
INSERT INTO credit_ledger (user_id, type, amount, note)
SELECT id, 'grant', 100, 'Development credits'
FROM auth.users
WHERE email = 'test@example.com';

-- Test draft
INSERT INTO draft_prompts (session_token, prompt_text)
VALUES ('test-session-123', 'Create a motivational video about never giving up');
```
