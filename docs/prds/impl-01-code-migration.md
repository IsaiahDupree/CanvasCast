# Implementation PRD: Code Migration from BlankLogo

**Type:** Implementation Guide  
**Priority:** P0  
**Status:** Ready for Implementation  

---

## 1. Overview

This document details what code to pull from BlankLogo-Source and what modifications are needed to create CanvasCast. BlankLogo is a logo animation SaaS that shares similar architecture (Next.js, Express, BullMQ, Supabase) with CanvasCast.

---

## 2. Migration Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        MIGRATION OVERVIEW                                │
│                                                                         │
│   BlankLogo-Source/              CanvasCast-Target/                     │
│   ├── apps/web/          ──────► apps/web/         (MODIFY)             │
│   ├── apps/api/          ──────► apps/api/         (MODIFY)             │
│   ├── apps/worker/       ──────► apps/worker/      (REPLACE PIPELINE)   │
│   ├── packages/          ──────► packages/         (ADD remotion)       │
│   ├── supabase/          ──────► supabase/         (NEW MIGRATIONS)     │
│   └── package.json       ──────► package.json      (UPDATE DEPS)        │
│                                                                         │
│   Legend: KEEP = copy as-is, MODIFY = copy + change, REPLACE = rewrite  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Root Level Files

### KEEP AS-IS (Copy Directly)
```
BlankLogo-Source/                    → CanvasCast-Target/
├── .gitignore                       → .gitignore
├── .nvmrc                           → .nvmrc
├── pnpm-workspace.yaml              → pnpm-workspace.yaml
├── turbo.json                       → turbo.json
├── tsconfig.json                    → tsconfig.json
└── docker-compose.yml               → docker-compose.yml
```

### MODIFY
```
BlankLogo-Source/package.json → CanvasCast-Target/package.json

CHANGES:
- name: "blanklogo" → "canvascast"
- Add workspace: "packages/remotion"
- Add dependencies for Remotion
```

**package.json changes:**
```diff
{
-  "name": "blanklogo",
+  "name": "canvascast",
   "workspaces": [
     "apps/*",
-    "packages/*"
+    "packages/*",
+    "packages/remotion"
   ],
   "scripts": {
+    "remotion:preview": "pnpm --filter remotion preview",
+    "remotion:build": "pnpm --filter remotion build",
   }
}
```

---

## 4. Apps/Web (Frontend)

### Directory: `apps/web/`

#### KEEP AS-IS
```
apps/web/
├── .env.example
├── .env.local
├── next.config.js
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── src/
│   ├── middleware.ts              ← Auth middleware (KEEP)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts          ← Supabase browser client (KEEP)
│   │   │   ├── server.ts          ← Supabase server client (KEEP)
│   │   │   └── middleware.ts      ← Auth middleware helper (KEEP)
│   │   └── utils.ts               ← Utility functions (KEEP)
│   ├── components/
│   │   └── ui/                    ← shadcn components (KEEP ALL)
│   └── hooks/
│       └── use-toast.ts           ← Toast hook (KEEP)
```

#### MODIFY
```
apps/web/src/app/
├── layout.tsx                     ← Change branding, metadata
├── page.tsx                       ← REPLACE with landing + prompt input
├── (auth)/
│   ├── login/page.tsx             ← Update UI styling
│   ├── signup/page.tsx            ← Update UI styling
│   └── auth/callback/route.ts     ← Add draft claim logic
├── app/                           ← Protected routes
│   ├── layout.tsx                 ← KEEP structure, update nav
│   ├── page.tsx                   ← REPLACE: Dashboard with projects
│   └── [NEW PAGES BELOW]
```

#### ADD NEW
```
apps/web/src/app/
├── api/
│   └── draft/
│       └── route.ts               ← NEW: Draft prompt API
├── app/
│   ├── new/
│   │   └── page.tsx               ← NEW: Create project form
│   ├── projects/
│   │   └── [id]/
│   │       └── page.tsx           ← NEW: Project detail
│   ├── jobs/
│   │   └── [id]/
│   │       └── page.tsx           ← NEW: Job progress stepper
│   └── credits/
│       └── page.tsx               ← NEW: Credit balance & purchase

apps/web/src/components/
├── prompt-input.tsx               ← NEW: Landing page prompt
├── project-card.tsx               ← NEW: Dashboard project card
├── job-stepper.tsx                ← NEW: Job progress visualization
├── credit-balance.tsx             ← NEW: Credit display
└── niche-selector.tsx             ← NEW: Niche preset picker
```

---

## 5. Apps/API (Express Server)

### Directory: `apps/api/`

#### KEEP AS-IS
```
apps/api/
├── package.json                   ← Update deps only
├── tsconfig.json
├── src/
│   ├── lib/
│   │   ├── supabase.ts            ← Supabase service client (KEEP)
│   │   ├── redis.ts               ← Redis connection (KEEP)
│   │   └── stripe.ts              ← Stripe client (KEEP)
│   └── middleware/
│       └── auth.ts                ← authenticateToken middleware (KEEP)
```

#### MODIFY: `apps/api/src/index.ts`

**Pull these sections (KEEP):**
```typescript
// KEEP: Server setup
import express from 'express';
import cors from 'cors';
const app = express();
app.use(cors());
app.use(express.json());

// KEEP: Redis & Queue setup
import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
const redis = new Redis(process.env.REDIS_URL);
const videoQueue = new Queue('video-jobs', { connection: redis });

// KEEP: Health endpoint
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// KEEP: Stripe webhook handling structure
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), ...);
```

**Replace these sections:**
```typescript
// REPLACE: Project creation endpoint
// OLD (BlankLogo): POST /api/v1/logos
// NEW (CanvasCast): POST /api/v1/projects

app.post('/api/v1/projects', authenticateToken, async (req, res) => {
  const { title, promptText, nichePreset, targetMinutes, voiceProfileId } = req.body;
  
  // Validate with Zod schema
  // Check credit balance
  // Create project record
  // Create job record
  // Reserve credits
  // Queue job to BullMQ
  // Return { projectId, jobId }
});

// REPLACE: Job status endpoint
// OLD: GET /api/v1/logos/:id/status
// NEW: GET /api/v1/jobs/:id/status

// ADD NEW endpoints:
// GET  /api/v1/projects          - List user projects
// GET  /api/v1/projects/:id      - Get project detail
// GET  /api/v1/jobs/:id/assets   - Get job assets/download
// POST /api/v1/voice-profiles    - Upload voice sample
// GET  /api/v1/credits/balance   - Get credit balance
```

---

## 6. Apps/Worker (Pipeline)

### Directory: `apps/worker/`

#### KEEP AS-IS
```
apps/worker/
├── package.json                   ← Update deps
├── tsconfig.json
├── Dockerfile                     ← KEEP structure, update deps
├── src/
│   ├── index.ts                   ← Worker entry (MODIFY queue name)
│   ├── lib/
│   │   ├── supabase.ts            ← Supabase client (KEEP)
│   │   └── redis.ts               ← Redis client (KEEP)
│   ├── cleanup.ts                 ← Cleanup logic (KEEP pattern)
│   └── notify.ts                  ← Notification helpers (KEEP)
```

#### REPLACE ENTIRELY: `apps/worker/src/pipeline/`

**DELETE BlankLogo pipeline:**
```
apps/worker/src/pipeline/          ← DELETE ALL (logo-specific)
├── runner.ts
├── steps/
│   ├── download-assets.ts
│   ├── generate-variations.ts
│   ├── render-animation.ts
│   └── upload-results.ts
```

**CREATE CanvasCast pipeline:**
```
apps/worker/src/pipeline/
├── runner.ts                      ← NEW: 9-step orchestrator
├── context.ts                     ← NEW: PipelineContext type
├── steps/
│   ├── generate-script.ts         ← NEW: LLM script generation
│   ├── generate-voice.ts          ← NEW: TTS audio
│   ├── run-alignment.ts           ← NEW: Whisper timestamps
│   ├── plan-visuals.ts            ← NEW: Scene planning
│   ├── generate-images.ts         ← NEW: Gemini Imagen
│   ├── build-timeline.ts          ← NEW: Remotion props
│   ├── render-video.ts            ← NEW: Remotion render
│   ├── package-assets.ts          ← NEW: ZIP & upload
│   └── complete-job.ts            ← NEW: Finalize & notify
```

#### ADD NEW Libraries
```
apps/worker/src/lib/
├── openai.ts                      ← NEW: OpenAI client (TTS, Whisper)
├── gemini.ts                      ← NEW: Gemini Imagen client
├── remotion.ts                    ← NEW: Remotion render client
├── captions.ts                    ← NEW: SRT/VTT generation
└── storage.ts                     ← NEW: Storage upload helpers
```

---

## 7. Packages

### KEEP: `packages/shared/`
```
packages/shared/                   ← MODIFY types, keep structure
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    └── types/                     ← UPDATE with CanvasCast types
```

### ADD NEW: `packages/remotion/`
```
packages/remotion/                 ← NEW PACKAGE
├── package.json
├── tsconfig.json
├── remotion.config.ts
└── src/
    ├── index.ts
    ├── Root.tsx
    ├── VideoComposition.tsx       ← Main composition
    └── components/
        ├── Scene.tsx              ← Image scene with Ken Burns
        ├── Caption.tsx            ← Animated captions
        └── AudioTrack.tsx         ← Audio layer
```

---

## 8. Supabase

### KEEP: `supabase/config.toml`

### KEEP (as base): Existing migrations
```
supabase/migrations/
├── 20240101_initial.sql           ← KEEP: Base auth setup
├── 20240102_profiles.sql          ← KEEP: Profiles table
├── 20240103_credits.sql           ← KEEP: Credit ledger (may need updates)
```

### ADD NEW Migrations
```
supabase/migrations/
├── 20260118_draft_prompts.sql     ← NEW: Draft prompts table
├── 20260118_projects.sql          ← NEW: Projects table
├── 20260118_jobs.sql              ← NEW: Jobs table with new statuses
├── 20260118_job_steps.sql         ← NEW: Job steps tracking
├── 20260118_assets.sql            ← NEW: Assets table
├── 20260118_voice_profiles.sql    ← NEW: Voice profiles
└── 20260118_rls_policies.sql      ← NEW: RLS for new tables
```

---

## 9. Environment Variables

### KEEP from BlankLogo
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Redis
REDIS_URL=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

### ADD for CanvasCast
```env
# OpenAI (TTS, Whisper, GPT)
OPENAI_API_KEY=

# Google Gemini (Image generation)
GEMINI_API_KEY=

# ElevenLabs (Optional TTS)
ELEVENLABS_API_KEY=

# Modal (GPU compute)
MODAL_TOKEN=
MODAL_ENDPOINT=

# Resend (Email)
RESEND_API_KEY=
```

---

## 10. Dependencies Changes

### apps/web/package.json
```diff
{
  "dependencies": {
+   "@remotion/player": "^4.0.0",    // Video preview
+   "zod": "^3.22.0",                // Validation
  }
}
```

### apps/api/package.json
```diff
{
  "dependencies": {
+   "zod": "^3.22.0",
+   "openai": "^4.0.0",
  }
}
```

### apps/worker/package.json
```diff
{
  "dependencies": {
+   "openai": "^4.0.0",              // TTS, Whisper, GPT
+   "@google/generative-ai": "^0.1.0", // Gemini
+   "@remotion/renderer": "^4.0.0",  // Video rendering
+   "@remotion/cli": "^4.0.0",
+   "fluent-ffmpeg": "^2.1.0",       // Audio processing
+   "archiver": "^6.0.0",            // ZIP creation
  }
}
```

---

## 11. File-by-File Checklist

### Phase 1: Foundation (Copy & Configure)
- [ ] Copy root config files (.gitignore, tsconfig, etc.)
- [ ] Copy `apps/web/` structure
- [ ] Copy `apps/api/` structure  
- [ ] Copy `apps/worker/` structure (except pipeline/)
- [ ] Copy `packages/shared/`
- [ ] Copy `supabase/` base config
- [ ] Update package.json names and deps

### Phase 2: Database (New Migrations)
- [ ] Create draft_prompts migration
- [ ] Create projects migration
- [ ] Create jobs migration (new statuses)
- [ ] Create job_steps migration
- [ ] Create assets migration
- [ ] Create RLS policies

### Phase 3: API (Modify Endpoints)
- [ ] Update POST /api/v1/projects
- [ ] Update GET /api/v1/jobs/:id
- [ ] Add credit endpoints
- [ ] Add voice profile endpoint

### Phase 4: Worker (New Pipeline)
- [ ] Create pipeline runner
- [ ] Create all 9 step files
- [ ] Create lib/ helpers (openai, gemini, etc.)
- [ ] Create Remotion package

### Phase 5: Frontend (New Pages)
- [ ] Update landing page
- [ ] Add draft API route
- [ ] Add project creation page
- [ ] Add job progress page
- [ ] Add credits page
- [ ] Update dashboard

---

## 12. Quick Reference: What NOT to Copy

```
BlankLogo-Source/
├── apps/worker/src/pipeline/      ❌ DELETE (logo-specific)
├── apps/worker/src/runpod-client.ts ❌ DELETE (not needed)
├── apps/web/src/app/editor/       ❌ DELETE (logo editor)
├── apps/web/src/components/logo-* ❌ DELETE (logo components)
└── Any logo-specific business logic ❌ DELETE
```
