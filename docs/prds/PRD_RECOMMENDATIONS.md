# PRD Recommendations & Code Improvements

> **Generated:** Jan 19, 2026  
> **Purpose:** Identify new PRD areas, uncovered gaps, and code improvements for the current development stage

---

## Table of Contents

1. [New PRD Suggestions](#new-prd-suggestions)
2. [Code Quality & Technical Debt](#code-quality--technical-debt)
3. [Security Hardening](#security-hardening)
4. [Performance Optimizations](#performance-optimizations)
5. [Developer Experience](#developer-experience)
6. [Observability & Monitoring](#observability--monitoring)
7. [User Experience Enhancements](#user-experience-enhancements)
8. [Implementation Priority Matrix](#implementation-priority-matrix)

---

## New PRD Suggestions

### 1. PRD: Error Recovery & Resilience

**Gap:** Current PRDs don't specify how to handle partial failures, retries, or user recovery paths.

**Recommended Coverage:**
- **Partial Asset Recovery** — If image gen succeeds but rendering fails, allow user to retry from last checkpoint
- **Credit Refund Policy** — Automatic refunds for jobs that fail before X% completion
- **Dead Letter Queue** — Jobs that fail 3+ times get flagged for manual review
- **User Self-Service Retry** — UI to retry individual pipeline steps (e.g., just re-render)

**Current Code Gap:**
```typescript
// runner.ts line 200, 244
// TODO: Send failure notification email
// TODO: Send completion notification email
```

---

### 2. PRD: Content Moderation & Safety

**Gap:** PRD.md mentions "restricted content filter" but no implementation or specification exists.

**Recommended Coverage:**
- **Input Validation** — Filter prompts for prohibited content before job creation
- **Output Scanning** — Check generated scripts/images for policy violations
- **Rate Limiting** — Per-user limits on job creation (abuse prevention)
- **Audit Trail** — Store original prompts for compliance review
- **Appeal Process** — User path to contest blocked content

**Implementation Needed:**
```typescript
// Before script generation
async function moderateContent(prompt: string): Promise<ModerationResult> {
  // OpenAI moderation API or custom rules
}
```

---

### 3. PRD: Analytics & Metrics

**Gap:** PRD_PROMPT_TO_VIDEO mentions PostHog events but no implementation exists.

**Recommended Coverage:**
- **Funnel Metrics** — landing → signup → first_video → paid_conversion
- **Pipeline Health** — success rates per step, avg duration, failure reasons
- **Cost Tracking** — API costs per job (OpenAI, image gen, storage)
- **User Behavior** — niche popularity, average video length, retry rates

**Implementation Needed:**
```typescript
// Add to key user actions
import { posthog } from '@/lib/analytics';

posthog.capture('job_started', { 
  niche: project.niche_preset,
  target_minutes: project.target_minutes 
});
```

---

### 4. PRD: Admin Dashboard

**Gap:** No admin tooling for support, debugging, or operations.

**Recommended Coverage:**
- **Job Inspector** — View any job's pipeline state, logs, artifacts
- **User Management** — Credit adjustments, account status
- **Queue Health** — Worker status, pending jobs, stuck jobs
- **Cost Dashboard** — Daily/weekly API spend by service
- **Content Moderation Queue** — Review flagged content

---

### 5. PRD: Notification System

**Gap:** Email system is stubbed but not implemented.

**Recommended Coverage:**
- **Transactional Emails:**
  - `job_completed` — "Your video is ready!"
  - `job_failed` — "Something went wrong" + retry link
  - `credits_low` — "You have X credits remaining"
  - `welcome` — Onboarding email with tips
- **Email Preferences** — User opt-in/out per category
- **Webhook Notifications** — For power users/integrations

**Current State:**
```typescript
// apps/web/src/lib/resend.ts — exists but no templates
// runner.ts — TODOs for sending emails
```

---

### 6. PRD: File Upload & Document Processing

**Gap:** Current implementation only handles text files.

**Current Code:**
```typescript
// ingest-inputs.ts line 107
// For now, assume text files. TODO: Add PDF/DOCX extraction
```

**Recommended Coverage:**
- **PDF Extraction** — Use pdf-parse or similar
- **DOCX Support** — mammoth.js for Word docs
- **Audio Transcription** — Whisper for voice notes
- **URL Scraping** — Extract content from blog posts
- **File Size Limits** — Max 10MB per file, 50MB total per project

---

## Code Quality & Technical Debt

### TODO Items in Codebase

| Location | Issue | Priority |
|----------|-------|----------|
| `runner.ts:200` | Send failure notification email | P0 |
| `runner.ts:244` | Send completion notification email | P0 |
| `ingest-inputs.ts:107` | Add PDF/DOCX extraction | P2 |
| `scripting.ts:69` | Replace mock script with real LLM call | P1 |

---

### Code Improvements

#### 1. Centralize Supabase Client Creation

**Problem:** Multiple files create their own Supabase clients.

```typescript
// Current: scattered across files
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
```

**Fix:** Use shared `createAdminSupabase()` everywhere.

---

#### 2. Add Request Validation with Zod

**Problem:** API routes lack consistent input validation.

**Fix:** Add Zod schemas for all API endpoints:

```typescript
// apps/web/src/app/api/projects/route.ts
import { z } from 'zod';

const CreateProjectSchema = z.object({
  title: z.string().min(1).max(200),
  niche_preset: z.enum(['explainer', 'motivation', ...]),
  target_minutes: z.number().min(1).max(30),
});
```

---

#### 3. Type Safety for Artifacts

**Problem:** `ctx.artifacts` uses `Record<string, unknown>`.

**Fix:** Define typed artifact interface:

```typescript
interface PipelineArtifacts {
  mergedInputText?: string;
  script?: Script;
  narrationPath?: string;
  narrationDurationMs?: number;
  whisperSegments?: WhisperSegment[];
  visualPlan?: VisualPlan;
  imagePaths?: string[];
  timeline?: Timeline;
  videoPath?: string;
  zipPath?: string;
}
```

---

#### 4. Error Codes Consistency

**Problem:** Some error codes don't match `JobErrorCode` type.

**Fix:** Ensure all `createStepError` calls use valid codes from `packages/shared/src/types.ts`.

---

#### 5. Environment Variable Validation

**Problem:** No startup validation of required env vars.

**Fix:** Add validation on worker/web startup:

```typescript
// apps/worker/src/lib/env.ts
import { z } from 'zod';

const EnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().optional(),
  // ...
});

export const env = EnvSchema.parse(process.env);
```

---

## Security Hardening

### 1. API Route Protection

**Issue:** Some internal APIs may lack proper auth checks.

**Recommendation:**
- Verify all `/api/projects/*` routes check `auth.uid() === project.user_id`
- Add rate limiting to public endpoints (`/api/draft`)
- Validate webhook signatures (Stripe)

---

### 2. Storage Security

**Issue:** Ensure signed URLs have appropriate TTL.

**Recommendation:**
```typescript
// Current: 1 hour expiry
const { data: signedUrl } = await supabase.storage
  .from("project-outputs")
  .createSignedUrl(path, 3600);

// Consider: shorter TTL for sensitive assets
```

---

### 3. Input Sanitization

**Issue:** User input flows directly to LLM prompts.

**Recommendation:**
- Sanitize prompt text before passing to OpenAI
- Limit prompt length (e.g., 10,000 chars max)
- Filter for prompt injection attempts

---

### 4. Secrets in Logs

**Issue:** Ensure API keys never appear in logs.

**Recommendation:**
- Review all `console.log` statements
- Use structured logging with automatic secret redaction

---

## Performance Optimizations

### 1. Image Generation Parallelization

**Current:** Images generated sequentially.

**Improvement:**
```typescript
// Generate images in parallel (with concurrency limit)
const results = await pMap(
  visualPlan.scenes,
  async (scene) => generateImage(scene),
  { concurrency: 3 }
);
```

---

### 2. Streaming Job Status

**Current:** Polling every 3 seconds.

**Improvement:** Use Supabase Realtime for instant updates:
```typescript
supabase
  .channel(`job:${jobId}`)
  .on('postgres_changes', { event: 'UPDATE', table: 'jobs' }, handleUpdate)
  .subscribe();
```

---

### 3. Asset Caching

**Recommendation:**
- Cache downloaded storage assets in worker temp dir
- Reuse audio/images if job is retried
- Add CDN for public assets

---

### 4. Database Indexes

**Verify indexes exist for:**
- `jobs(status, created_at)` — queue polling
- `jobs(user_id, created_at)` — user job list
- `assets(job_id, type)` — asset lookup
- `credit_ledger(user_id)` — balance calculation

---

## Developer Experience

### 1. Local Development Scripts

**Add to package.json:**
```json
{
  "scripts": {
    "dev:all": "concurrently \"pnpm dev\" \"pnpm dev:worker\"",
    "test:watch": "vitest",
    "db:seed": "supabase db reset && tsx scripts/seed.ts",
    "lint:fix": "eslint --fix .",
    "type-check": "tsc --noEmit"
  }
}
```

---

### 2. Debug Mode for Worker

**Add verbose logging flag:**
```typescript
const DEBUG = process.env.DEBUG === 'true';

if (DEBUG) {
  console.log('[Pipeline] Artifact state:', JSON.stringify(ctx.artifacts, null, 2));
}
```

---

### 3. Mock Mode for E2E

**Current:** `USE_REMOTION=false` uses ffmpeg fallback.

**Enhancement:** Add `MOCK_MODE=true` for instant fake renders:
```typescript
if (process.env.MOCK_MODE === 'true') {
  // Skip all external APIs, use mock data
  return createStepResult({ videoPath: 'mock/video.mp4' });
}
```

---

### 4. API Documentation

**Generate OpenAPI spec from routes:**
- Use `next-swagger-doc` or similar
- Document all endpoints with request/response schemas

---

## Observability & Monitoring

### 1. Structured Logging

**Replace console.log with structured logger:**
```typescript
import pino from 'pino';

const logger = pino({ 
  level: process.env.LOG_LEVEL ?? 'info',
  redact: ['apiKey', 'password', 'token']
});

logger.info({ jobId, step: 'SCRIPTING', progress: 15 }, 'Starting script generation');
```

---

### 2. Error Tracking (Sentry)

**Add to worker and web:**
```typescript
import * as Sentry from '@sentry/node';

Sentry.init({ dsn: process.env.SENTRY_DSN });

// Wrap pipeline steps
try {
  await generateScript(ctx);
} catch (error) {
  Sentry.captureException(error, { extra: { jobId: ctx.jobId } });
  throw error;
}
```

---

### 3. Metrics Dashboard

**Track:**
- Jobs created per hour/day
- Pipeline success rate
- Average job duration by step
- API costs (OpenAI, image gen)
- Worker queue depth

---

### 4. Health Check Endpoint

**Add `/api/health`:**
```typescript
export async function GET() {
  const dbOk = await checkDatabase();
  const storageOk = await checkStorage();
  
  return Response.json({
    status: dbOk && storageOk ? 'healthy' : 'degraded',
    db: dbOk,
    storage: storageOk,
    timestamp: new Date().toISOString()
  });
}
```

---

## User Experience Enhancements

### 1. Video Preview Player

**Current:** Download link only.

**Enhancement:** Embed video player on result page:
```tsx
<video 
  src={downloads.video} 
  controls 
  className="w-full rounded-xl"
/>
```

---

### 2. Progress Notifications

**Add browser notifications:**
```typescript
if (Notification.permission === 'granted' && project.status === 'ready') {
  new Notification('Your video is ready!', {
    body: project.title,
    icon: '/images/logo-icon.png'
  });
}
```

---

### 3. Project Duplication

**Add "Duplicate" button:**
- Copy project settings (niche, target_minutes, inputs)
- Create new draft project
- Useful for iterating on videos

---

### 4. Keyboard Shortcuts

**Add to dashboard:**
- `N` — New project
- `G` — Generate (when on project page)
- `?` — Show shortcuts modal

---

## Implementation Priority Matrix

| Item | Impact | Effort | Priority |
|------|--------|--------|----------|
| Email notifications | High | Low | **P0** |
| Content moderation | High | Medium | **P0** |
| Error tracking (Sentry) | High | Low | **P0** |
| Zod validation | Medium | Low | **P1** |
| PDF/DOCX extraction | Medium | Medium | **P1** |
| Real script generation (replace mock) | High | Medium | **P1** |
| Analytics (PostHog) | Medium | Low | **P1** |
| Structured logging | Medium | Low | **P1** |
| Image parallelization | Medium | Low | **P2** |
| Realtime job updates | Medium | Medium | **P2** |
| Admin dashboard | Medium | High | **P2** |
| Video preview player | Low | Low | **P2** |
| Project duplication | Low | Low | **P3** |
| Keyboard shortcuts | Low | Low | **P3** |

---

## Quick Wins (< 1 hour each)

1. **Add Sentry** — 30 min
2. **Video preview player** — 15 min
3. **Health check endpoint** — 20 min
4. **Environment validation** — 30 min
5. **Zod schemas for 3 main API routes** — 45 min

---

## Appendix: Files to Modify

| Enhancement | Files |
|-------------|-------|
| Email notifications | `apps/worker/src/pipeline/runner.ts`, `apps/web/src/lib/emails/` (new) |
| Content moderation | `apps/web/src/app/api/projects/route.ts`, `packages/shared/src/moderation.ts` (new) |
| Analytics | `apps/web/src/lib/analytics.ts` (new), all route handlers |
| Error tracking | `apps/worker/src/index.ts`, `apps/web/src/app/layout.tsx` |
| Zod validation | `packages/shared/src/validators.ts` (expand), API routes |

---

## Additional Gaps Identified

### 7. PRD: CI/CD Pipeline

**Gap:** No `.github/workflows` directory — no automated testing or deployment.

**Recommended Coverage:**
- **PR Checks:**
  - TypeScript type checking (`tsc --noEmit`)
  - ESLint
  - Unit tests (`vitest run`)
  - E2E tests on staging (optional)
- **Deploy Pipeline:**
  - Auto-deploy `main` to Vercel (web)
  - Auto-deploy `main` to Railway (worker)
  - Run migrations on deploy
- **Security Scanning:**
  - Dependency audit (`pnpm audit`)
  - Secret scanning

**Example GitHub Actions:**
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm type-check
      - run: pnpm lint
      - run: pnpm test:ci
```

---

### 8. PRD: Remotion Production Setup

**Gap:** Remotion package exists but appears minimal. Worker uses ffmpeg fallback by default.

**Current State:**
```typescript
// render-video.ts line 23
const USE_REMOTION = process.env.USE_REMOTION === "true";
// Defaults to ffmpeg composite mode
```

**Recommended Coverage:**
- **Remotion Composition** — Full video template with Ken Burns, transitions, captions
- **Lambda Rendering** — Use Remotion Lambda for scalable production rendering
- **Template Variants** — Multiple visual styles per niche
- **Preview Generation** — Quick thumbnail/preview before full render

---

### 9. PRD: Multi-language Support (i18n)

**Gap:** No internationalization infrastructure.

**Recommended Coverage (Post-MVP):**
- UI translation framework (next-intl or similar)
- Locale detection
- RTL support
- Multi-language TTS voices

---

### 10. PRD: Accessibility (a11y)

**Gap:** E2E tests include `accessibility.spec.ts` but no documented standards.

**Recommended Coverage:**
- WCAG 2.1 AA compliance target
- Keyboard navigation for all flows
- Screen reader testing
- Color contrast requirements
- Focus management

---

### 11. PRD: Data Retention & GDPR

**Gap:** No documented data retention policy.

**Recommended Coverage:**
- **Asset Retention** — Auto-delete job assets after X days
- **Account Deletion** — User can request full data deletion
- **Data Export** — User can download all their data
- **Cookie Consent** — GDPR-compliant consent banner
- **Privacy Policy** — Document data handling practices

---

### 12. PRD: Rate Limiting & Abuse Prevention

**Gap:** No rate limiting on public endpoints.

**Current Risk:**
- `/api/draft` — Anyone can spam draft creation
- Image generation — Expensive API calls per job

**Recommended Coverage:**
```typescript
// Use Upstash Redis or similar
import { Ratelimit } from "@upstash/ratelimit";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 requests per minute
});

// In API route
const { success } = await ratelimit.limit(ip);
if (!success) return NextResponse.json({ error: "Rate limited" }, { status: 429 });
```

---

## Code Quality Updates

### Already Implemented ✅

After further review, these items are **already done**:

| Item | Status |
|------|--------|
| Zod validation on `/api/projects` | ✅ Exists |
| Zod validation on `/api/draft` | ✅ Exists |
| Draft prompt pre-auth flow | ✅ Fully implemented |
| Session token handling | ✅ Cookie-based |

### Still Missing ❌

| Item | Priority |
|------|----------|
| CI/CD workflows | P1 |
| Remotion production templates | P1 |
| Rate limiting | P1 |
| Email notifications | P0 |
| Error tracking (Sentry) | P0 |
| Data retention policy | P2 |

---

## Updated Priority Matrix

| Item | Impact | Effort | Priority |
|------|--------|--------|----------|
| **Email notifications** | High | Low | **P0** |
| **Error tracking (Sentry)** | High | Low | **P0** |
| **CI/CD pipeline** | High | Medium | **P1** |
| **Rate limiting** | High | Low | **P1** |
| **Remotion production setup** | High | High | **P1** |
| **Content moderation** | High | Medium | **P1** |
| **Analytics (PostHog)** | Medium | Low | **P1** |
| **PDF/DOCX extraction** | Medium | Medium | **P2** |
| **Data retention/GDPR** | Medium | Medium | **P2** |
| **Admin dashboard** | Medium | High | **P2** |
| **i18n** | Low | High | **P3** |

---

*Last updated: Jan 19, 2026*
