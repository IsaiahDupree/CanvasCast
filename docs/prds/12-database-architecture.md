# PRD: Database & Schema Architecture

**Subsystem:** Database  
**Version:** 1.0  
**Status:** Implemented  
**Owner:** Isaiah  

---

## 1. Overview

The Database subsystem uses Supabase (PostgreSQL) as the primary data store. It handles all persistent data including users, projects, jobs, credits, and assets. The schema is managed through versioned migrations.

### Business Goal
Provide reliable, scalable data persistence with strong consistency guarantees and real-time capabilities.

---

## 2. User Stories

### US-1: Data Persistence
**As a** system  
**I need** reliable data storage  
**So that** user data survives restarts and failures

### US-2: Query Performance
**As a** user  
**I want** fast page loads  
**So that** the app feels responsive

### US-3: Data Integrity
**As a** system  
**I need** referential integrity  
**So that** data remains consistent

---

## 3. Schema Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATABASE SCHEMA                                │
│                                                                         │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐           │
│  │  auth.users  │────►│   profiles   │────►│credit_ledger │           │
│  │  (Supabase)  │     │              │     │              │           │
│  └──────────────┘     └──────────────┘     └──────────────┘           │
│         │                    │                                         │
│         │                    │                                         │
│         ▼                    ▼                                         │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐           │
│  │draft_prompts │     │   projects   │────►│     jobs     │           │
│  │              │     │              │     │              │           │
│  └──────────────┘     └──────────────┘     └──────┬───────┘           │
│                                                    │                   │
│                              ┌─────────────────────┼─────────────────┐ │
│                              ▼                     ▼                 ▼ │
│                       ┌──────────────┐     ┌──────────────┐  ┌───────┐│
│                       │  job_steps   │     │    assets    │  │ logs  ││
│                       │              │     │              │  │       ││
│                       └──────────────┘     └──────────────┘  └───────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Core Tables

### Table: `profiles`
Extends Supabase auth.users with app-specific data.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  notification_prefs JSONB DEFAULT '{"job_complete": true, "job_failed": true}',
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_stripe ON profiles(stripe_customer_id);
```

### Table: `draft_prompts`
Pre-auth prompt storage.

```sql
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
CREATE INDEX idx_draft_user ON draft_prompts(user_id);
CREATE INDEX idx_draft_expires ON draft_prompts(expires_at);
```

### Table: `projects`
Video project configuration.

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  niche_preset TEXT NOT NULL CHECK (niche_preset IN (
    'motivation', 'explainer', 'facts', 'history', 'finance', 'science'
  )),
  target_minutes INTEGER NOT NULL DEFAULT 1 CHECK (target_minutes BETWEEN 1 AND 10),
  voice_profile_id UUID,
  transcript_mode TEXT DEFAULT 'auto' CHECK (transcript_mode IN ('auto', 'manual')),
  transcript_text TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_projects_created ON projects(created_at DESC);
```

### Table: `jobs`
Video generation job tracking.

```sql
CREATE TYPE job_status AS ENUM (
  'PENDING', 'QUEUED', 'SCRIPTING', 'VOICE_GEN', 'ALIGNMENT',
  'VISUAL_PLAN', 'IMAGE_GEN', 'TIMELINE', 'RENDERING', 
  'PACKAGING', 'READY', 'FAILED'
);

CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status job_status NOT NULL DEFAULT 'PENDING',
  progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
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
  finished_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_jobs_user ON jobs(user_id);
CREATE INDEX idx_jobs_project ON jobs(project_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_created ON jobs(created_at DESC);
```

### Table: `job_steps`
Detailed step tracking within a job.

```sql
CREATE TYPE step_status AS ENUM ('pending', 'started', 'succeeded', 'failed');

CREATE TABLE job_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  state step_status DEFAULT 'pending',
  progress_pct INTEGER DEFAULT 0,
  status_message TEXT,
  error_message TEXT,
  logs_url TEXT,
  artifacts_json JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_job_steps_job ON job_steps(job_id);
CREATE UNIQUE INDEX idx_job_steps_unique ON job_steps(job_id, step_name);
```

### Table: `credit_ledger`
Immutable credit transaction log.

```sql
CREATE TABLE credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'purchase', 'usage', 'refund', 'grant', 'expire', 'reserve', 'subscription'
  )),
  amount INTEGER NOT NULL,
  balance_after INTEGER,
  note TEXT,
  job_id UUID REFERENCES jobs(id),
  stripe_payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_credit_user ON credit_ledger(user_id);
CREATE INDEX idx_credit_job ON credit_ledger(job_id);
CREATE INDEX idx_credit_created ON credit_ledger(created_at DESC);
```

### Table: `assets`
Generated asset tracking.

```sql
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'video', 'audio', 'image', 'captions', 'manifest', 'zip'
  )),
  url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes BIGINT,
  mime_type TEXT,
  metadata_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_assets_job ON assets(job_id);
CREATE INDEX idx_assets_type ON assets(type);
```

---

## 5. RPC Functions

### Credit Balance
```sql
CREATE OR REPLACE FUNCTION get_credit_balance(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(SUM(amount), 0)::INTEGER
  FROM credit_ledger
  WHERE user_id = p_user_id;
$$ LANGUAGE sql STABLE;
```

### Reserve Credits
```sql
CREATE OR REPLACE FUNCTION reserve_credits(
  p_user_id UUID,
  p_job_id UUID,
  p_amount INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  SELECT get_credit_balance(p_user_id) INTO v_balance;
  
  IF v_balance < p_amount THEN
    RETURN FALSE;
  END IF;
  
  INSERT INTO credit_ledger (user_id, type, amount, job_id, note)
  VALUES (p_user_id, 'reserve', -p_amount, p_job_id, 'Reserved for job');
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

### Claim Draft
```sql
CREATE OR REPLACE FUNCTION claim_draft_prompt(
  p_session_token TEXT,
  p_user_id UUID
) RETURNS UUID AS $$
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
$$ LANGUAGE plpgsql;
```

---

## 6. Triggers

### New User Setup
```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile
  INSERT INTO profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name');
  
  -- Grant trial credits
  INSERT INTO credit_ledger (user_id, type, amount, note)
  VALUES (NEW.id, 'grant', 10, 'Welcome bonus: 1 free video trial');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### Updated Timestamps
```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_profiles_updated
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_projects_updated
BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 7. Row Level Security (RLS)

### Profiles
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY profiles_update ON profiles
  FOR UPDATE USING (auth.uid() = id);
```

### Projects
```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY projects_all ON projects
  USING (auth.uid() = user_id);
```

### Jobs
```sql
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY jobs_select ON jobs
  FOR SELECT USING (auth.uid() = user_id);
```

### Credit Ledger
```sql
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY credit_select ON credit_ledger
  FOR SELECT USING (auth.uid() = user_id);
```

---

## 8. Migrations

Migrations are stored in `supabase/migrations/` with timestamp prefixes:

```
supabase/migrations/
├── 20260101000000_initial_schema.sql
├── 20260102000000_add_profiles.sql
├── 20260103000000_add_projects_jobs.sql
├── 20260104000000_add_credits.sql
├── 20260105000000_add_job_steps.sql
├── 20260106000000_add_assets.sql
├── 20260107000000_add_rls_policies.sql
└── 20260118000000_draft_prompts_job_steps.sql
```

### Running Migrations
```bash
# Apply all pending migrations
pnpm db:migrate

# Reset and re-run all migrations
pnpm db:reset

# Generate new migration
pnpm db:migrate:new add_feature_name
```

---

## 9. Performance Optimization

### Indexes Strategy
- Primary keys: Auto-indexed
- Foreign keys: Explicit indexes for JOIN performance
- Status columns: For filtered queries
- Timestamps: For ordering and cleanup

### Query Patterns
```sql
-- Efficient user dashboard query
SELECT p.*, j.status, j.progress
FROM projects p
LEFT JOIN LATERAL (
  SELECT status, progress
  FROM jobs
  WHERE project_id = p.id
  ORDER BY created_at DESC
  LIMIT 1
) j ON true
WHERE p.user_id = $1
ORDER BY p.created_at DESC
LIMIT 20;
```

### Connection Pooling
```typescript
// Supabase handles pooling via PgBouncer
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    db: {
      schema: 'public',
    },
    auth: {
      persistSession: false,
    },
  }
);
```

---

## 10. Backup & Recovery

### Automated Backups
- Supabase Pro: Daily automated backups
- Point-in-time recovery: 7 days

### Manual Backup
```bash
# Export schema and data
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

---

## 11. System Integration

### Communicates With

| Subsystem | Direction | Mechanism | Purpose |
|-----------|-----------|-----------|---------|
| **All Subsystems** | * ↔ DB | Supabase client | Data persistence |
| **Auth** | Auth → DB | Trigger | User profile creation |
| **Pipeline** | Pipeline → DB | Direct queries | Job status updates |
| **Billing** | Billing → DB | RPC functions | Credit operations |
| **Frontend** | Frontend → DB | Supabase client | Direct queries with RLS |

### Access Patterns

| Client | Access Method | Auth |
|--------|---------------|------|
| Frontend | Supabase JS client | User JWT (anon key) |
| API | Supabase service client | Service role key |
| Worker | Supabase service client | Service role key |

### Data Flow
```
┌─────────────────────────────────────────────────────────────────┐
│                      DATABASE SUBSYSTEM                          │
│                                                                 │
│  ┌──────────────┐                      ┌──────────────────┐    │
│  │   Frontend   │──── User queries ───►│                  │    │
│  │  (anon key)  │     (RLS enforced)   │                  │    │
│  └──────────────┘                      │                  │    │
│                                        │    PostgreSQL    │    │
│  ┌──────────────┐                      │                  │    │
│  │     API      │──── Service queries ►│  - Tables        │    │
│  │(service key) │     (bypass RLS)     │  - RLS Policies  │    │
│  └──────────────┘                      │  - Functions     │    │
│                                        │  - Triggers      │    │
│  ┌──────────────┐                      │                  │    │
│  │   Worker     │──── Service queries ►│                  │    │
│  │(service key) │     (bypass RLS)     │                  │    │
│  └──────────────┘                      └──────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. Files

| File | Purpose |
|------|---------|
| `supabase/migrations/*.sql` | Schema migrations |
| `supabase/config.toml` | Supabase configuration |
| `supabase/seed.sql` | Development seed data |
| `apps/web/src/lib/supabase/client.ts` | Frontend client |
| `apps/web/src/lib/supabase/server.ts` | Server client |
| `apps/api/src/lib/supabase.ts` | API client |
| `packages/shared/src/types/database.ts` | Type definitions |
