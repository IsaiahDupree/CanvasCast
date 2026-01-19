# Autonomous Agent Development Guide

> **Purpose**: This document guides autonomous coding agents through the CanvasCast development process.

## Quick Reference

| File | Purpose |
|------|---------|
| `feature_list.json` | 156 features with acceptance criteria - YOUR PRIMARY TASK LIST |
| `claude-progress.txt` | Session log - UPDATE AFTER EACH SESSION |
| `README.md` | Project overview and setup instructions |
| `DEVELOPER_HANDOFF.md` | Complete architecture and migration guide |

## Your Mission

Transform CanvasCast from scaffolding into a production-ready AI video generation platform by implementing all 156 features in `feature_list.json`.

## Current Status (2026-01-18)

### ✅ What Already Exists

**Infrastructure:**
- ✅ Monorepo structure (pnpm workspace)
- ✅ Apps: web (Next.js), api (Express), worker (BullMQ)
- ✅ Packages: shared, remotion
- ✅ Database migrations (9 files in supabase/migrations/)
- ✅ Environment variable templates (.env.example files)

**Code:**
- ✅ API server (`apps/api/src/index.ts` - 20KB, Express routes exist)
- ✅ Worker pipeline (`apps/worker/src/pipeline/runner.ts` - 8KB)
- ✅ Pipeline steps (16 files in `apps/worker/src/pipeline/steps/`)
- ✅ Web pages (landing, signup, login, pricing, app dashboard, job status, new project)
- ✅ Supabase clients and middleware
- ✅ Remotion compositions

**Database:**
- ✅ Tables: profiles, projects, jobs, job_steps, draft_prompts, credit_ledger, assets
- ✅ RLS policies
- ✅ RPC functions (partially implemented)

### ❌ What Needs Verification/Implementation

**All 156 features are marked `"passes": false`** - they need to be:
1. Verified against acceptance criteria
2. Implemented if missing
3. Tested
4. Marked as `"passes": true`

## How to Work

### Step 1: Start with Phase 1 (Foundation)

```bash
# Check features FOUND-001 through FOUND-005
grep -A10 "FOUND-00" feature_list.json
```

**Foundation Features:**
- FOUND-001: Monorepo Setup
- FOUND-002: Shared Types Package
- FOUND-003: Shared Schemas Package
- FOUND-004: Environment Configuration
- FOUND-005: Remotion Package Setup

### Step 2: For Each Feature

1. **Read the feature definition** in `feature_list.json`
   - Review `description`, `acceptance`, `files`

2. **Check if code exists**
   - Read the files listed in `"files": [...]`
   - Verify against acceptance criteria

3. **Implement or fix**
   - If missing: implement it
   - If incomplete: complete it
   - If broken: fix it

4. **Test**
   - Write unit/integration tests
   - Verify acceptance criteria are met

5. **Update feature_list.json**
   - Change `"passes": false` to `"passes": true`
   - Only mark as passing when ALL acceptance criteria are met

6. **Update claude-progress.txt**
   - Log what you did
   - Note any blockers or discoveries

### Step 3: Move to Next Phase

Recommended order:
1. **Phase 1**: Foundation (verify monorepo works)
2. **Phase 2**: Database (test all migrations and RPC functions)
3. **Phase 3**: Authentication (verify auth flows work)
4. **Phase 4**: Draft System (test pre-auth prompt capture)
5. **Phase 5**: API (implement all endpoints)
6. **Phase 6**: Worker (verify pipeline orchestration)
7. **Phase 7**: Pipeline Steps (implement all 9 steps + Remotion)
8. **Phase 8**: Frontend (build all UI pages)
9. **Phase 9**: Billing (integrate Stripe)
10. **Phase 10**: Email (set up notifications)
11. **Phase 11**: Storage (configure asset storage)
12. **Phase 12**: Testing & Deploy (E2E tests, CI/CD)

## Testing Strategy

### For Each Feature

```typescript
// Example: Testing FOUND-002 (Shared Types Package)

// 1. Verify package.json exists
readFile('packages/shared/package.json')

// 2. Verify types are exported
readFile('packages/shared/src/types.ts')
readFile('packages/shared/src/index.ts')

// 3. Try importing in another app
// In apps/web or apps/api:
import { Project, Job } from '@canvascast/shared'

// 4. If all works, mark "passes": true
```

### Test Commands

```bash
# Unit tests
pnpm test:unit

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e

# Type checking
pnpm typecheck

# Full test suite
pnpm test
```

## Common Patterns

### 1. Verifying Database Migrations

```bash
# Start local Supabase
pnpm supabase start

# Apply migrations
pnpm supabase db push

# Check if table exists
# Use Supabase Studio: http://localhost:54323
```

### 2. Testing API Endpoints

```bash
# Start API server
pnpm dev:api

# Test endpoint
curl -X POST http://localhost:8989/api/v1/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"prompt": "test"}'
```

### 3. Testing Worker Pipeline

```bash
# Start worker
pnpm dev:worker

# Create a job via API
# Watch worker logs for processing
```

### 4. Testing Frontend

```bash
# Start Next.js
pnpm dev

# Open http://localhost:3000
# Test user flows manually
```

## Acceptance Criteria Examples

Each feature has specific acceptance criteria. Here's how to verify them:

### Example: FOUND-001 (Monorepo Setup)

**Acceptance Criteria:**
- [x] "pnpm install works" → Run `pnpm install`, verify no errors
- [x] "All workspaces linked" → Check `node_modules/@canvascast/`
- [x] "turbo dev runs all apps" → Run `pnpm dev:all`, verify all start

**How to Mark:**
```json
{
  "id": "FOUND-001",
  "passes": true  // ← Only change this when ALL criteria pass
}
```

### Example: DB-001 (Profiles Table)

**Acceptance Criteria:**
- [ ] "Table created" → Check Supabase Studio
- [ ] "FK to auth.users" → Verify foreign key exists
- [ ] "RLS policies applied" → Test row-level security

**Verification:**
```sql
-- In Supabase SQL Editor
SELECT * FROM profiles LIMIT 1;
SELECT * FROM pg_policies WHERE tablename = 'profiles';
```

## File Organization

```
/CanvasCast-Target/
├── feature_list.json         ← YOUR TASK LIST (update "passes" as you go)
├── claude-progress.txt       ← LOG YOUR WORK HERE
├── README.md                 ← Project overview
├── DEVELOPER_HANDOFF.md      ← Architecture guide
├── AUTONOMOUS_AGENT_GUIDE.md ← This file
│
├── apps/
│   ├── web/                  ← Next.js (port 3000)
│   ├── api/                  ← Express (port 8989)
│   └── worker/               ← BullMQ worker
│
├── packages/
│   ├── shared/               ← Types, schemas, utils
│   └── remotion/             ← Video composition
│
├── supabase/
│   └── migrations/           ← 9 migration files
│
├── docs/
│   └── prds/                 ← 18 detailed PRDs
│
└── tests/                    ← Unit, integration, E2E
```

## Priority System

**P0 (Critical) - 106 features**
- Must be implemented for MVP
- Block production deployment if not done
- Focus on these first

**P1 (High) - 39 features**
- Important for production quality
- Implement after P0 features

**P2 (Medium) - 11 features**
- Nice to have
- Can be deferred

## Updating Progress

### After Each Feature

1. **Update feature_list.json:**
```json
{
  "id": "FOUND-001",
  "passes": true  // Changed from false
}
```

2. **Update claude-progress.txt:**
```
SESSION 2 - FOUNDATION PHASE
Date: 2026-01-18
Features completed:
- FOUND-001: Monorepo Setup ✓
  - Verified pnpm install works
  - All workspaces linked correctly
  - dev:all runs all three apps

Next session: FOUND-002 (Shared Types Package)
```

### After Each Session

Add a session summary to `claude-progress.txt`:

```
================================================================================
SESSION N - [PHASE NAME]
================================================================================
Date: YYYY-MM-DD
Agent: [Your identifier]
Status: [COMPLETED | IN_PROGRESS | BLOCKED]

COMPLETED FEATURES:
- FOUND-XXX: Feature Name ✓
- DB-XXX: Another Feature ✓

CURRENT STATUS:
- Total completed: X / 156 (Y%)
- Phase 1: X / 5
- Phase 2: X / 15
- etc.

BLOCKERS:
- [List any blockers or issues]

NOTES:
- [Any important discoveries or decisions]

NEXT STEPS:
- [What the next agent should work on]

================================================================================
END SESSION N
================================================================================
```

## Integration Points

### Supabase
- Database: PostgreSQL with RLS
- Auth: Magic links + OAuth
- Storage: Asset storage (S3-compatible)

### External APIs
- **OpenAI**: GPT-4 (scripts), TTS (voice), Whisper (alignment)
- **Google Gemini**: Image generation
- **Stripe**: Payments and subscriptions
- **Resend**: Email notifications
- **Modal**: GPU compute (optional)

### Environment Variables
All required in `.env.example` files - verify they're documented.

## Common Issues

### 1. "pnpm install fails"
- Check Node version: `node -v` (should be >= 20)
- Check pnpm version: `pnpm -v` (should be >= 9.0.0)
- Clear cache: `pnpm store prune`

### 2. "Supabase migrations fail"
- Ensure Supabase is running: `pnpm supabase status`
- Reset if needed: `pnpm supabase db reset`

### 3. "TypeScript errors"
- Generate Supabase types: `pnpm supabase gen types typescript`
- Check tsconfig.json paths

### 4. "Tests fail"
- Check environment variables
- Ensure Supabase is running
- Reset test database if needed

## Success Criteria

### For Each Phase

**Phase Complete When:**
- All features in phase have `"passes": true`
- All acceptance criteria verified
- Tests written and passing
- Documentation updated

### For Overall Project

**MVP Complete When:**
- All P0 features (106) have `"passes": true`
- End-to-end flow works: Prompt → Video Download
- All critical tests passing
- Production deployment successful

## Getting Help

**For Architecture Questions:**
- Read `DEVELOPER_HANDOFF.md`
- Check relevant PRD in `docs/prds/`

**For Feature Details:**
- Check `feature_list.json` for acceptance criteria
- Review `files` array for relevant code

**For API Specs:**
- See PRDs in `docs/prds/impl-02-api-changes.md`
- Check `docs/prds/00-system-integration.md`

## Final Checklist Before Production

- [ ] All P0 features pass
- [ ] All P1 features pass (recommended)
- [ ] E2E tests pass
- [ ] Security audit complete
- [ ] Performance tested
- [ ] Error tracking configured (Sentry)
- [ ] Analytics configured (PostHog)
- [ ] Environment variables documented
- [ ] Production Supabase configured
- [ ] Stripe production keys configured
- [ ] Email service configured
- [ ] CDN configured
- [ ] Monitoring dashboards set up

---

**Remember**: You're building a production system. Quality > Speed. Verify thoroughly before marking features as passing.

**Good luck, autonomous agent! 🤖**
