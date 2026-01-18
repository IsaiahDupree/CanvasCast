# CanvasCast Developer Handoff Document

**Project:** CanvasCast - AI Video Generation Platform  
**Version:** 1.0  
**Date:** January 2026  
**Source:** BlankLogo-Source (scaffolding to reuse)  
**Target:** CanvasCast-Target  

---

## Quick Start

```bash
# 1. Clone and setup
cd CanvasCast-Target
pnpm install

# 2. Setup environment
cp .env.example .env.local
# Fill in API keys (see Environment Variables below)

# 3. Run database migrations
pnpm supabase db push

# 4. Start development
pnpm dev
```

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Summary](#2-architecture-summary)
3. [Subsystem PRDs](#3-subsystem-prds)
4. [Implementation Guides](#4-implementation-guides)
5. [Migration from BlankLogo](#5-migration-from-blanklogo)
6. [Environment Variables](#6-environment-variables)
7. [Development Workflow](#7-development-workflow)

---

## 1. Project Overview

CanvasCast transforms text prompts into fully produced short-form videos with AI-generated scripts, voiceover, images, and captions.

### Core Flow
```
User Prompt → Script (GPT-4) → Voice (TTS) → Alignment (Whisper) 
           → Images (Gemini) → Video (Remotion) → Download
```

### Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React, TailwindCSS, shadcn/ui |
| API | Express.js, BullMQ |
| Worker | Node.js, Remotion, FFmpeg |
| Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage (S3-compatible) |
| Auth | Supabase Auth (Magic Links, OAuth) |
| Payments | Stripe |
| AI | OpenAI (GPT-4, TTS, Whisper), Google Gemini |
| Compute | Modal (GPU functions) |

---

## 2. Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                    │
│  Next.js 14 App Router │ React Server Components │ TailwindCSS          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                                API                                       │
│  Express.js │ /api/v1/projects │ /api/v1/jobs │ Stripe Webhooks         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌──────────────────────────┐         ┌──────────────────────────┐
│       Redis/BullMQ       │         │        Supabase          │
│      Job Queue           │         │  PostgreSQL + Storage    │
└──────────────────────────┘         └──────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              WORKER                                      │
│  9-Step Pipeline: Script → Voice → Align → Images → Render → Package   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              ┌──────────┐   ┌──────────┐   ┌──────────┐
              │  OpenAI  │   │  Gemini  │   │  Modal   │
              │ GPT/TTS  │   │  Imagen  │   │   GPU    │
              └──────────┘   └──────────┘   └──────────┘
```

---

## 3. Subsystem PRDs

All PRDs are located in [`docs/prds/`](./docs/prds/README.md)

### Core Subsystems

| # | PRD | Description | Key Files |
|---|-----|-------------|-----------|
| 00 | [System Integration](./docs/prds/00-system-integration.md) | How all subsystems communicate | - |
| 01 | [Draft/Prompt](./docs/prds/01-draft-prompt-system.md) | Pre-auth prompt capture | `apps/web/src/app/api/draft/` |
| 02 | [Authentication](./docs/prds/02-authentication-system.md) | Supabase Auth flows | `apps/web/src/middleware.ts` |
| 03 | [Job Pipeline](./docs/prds/03-job-pipeline-orchestration.md) | BullMQ orchestration | `apps/worker/src/pipeline/` |
| 04 | [Script Generation](./docs/prds/04-script-generation.md) | LLM script creation | `apps/worker/src/pipeline/steps/generate-script.ts` |
| 05 | [Voice Generation](./docs/prds/05-voice-generation.md) | TTS audio | `apps/worker/src/pipeline/steps/generate-voice.ts` |
| 06 | [Alignment](./docs/prds/06-alignment-system.md) | Whisper timestamps | `apps/worker/src/pipeline/steps/run-alignment.ts` |
| 07 | [Image Generation](./docs/prds/07-image-generation.md) | Gemini Imagen | `apps/worker/src/pipeline/steps/generate-images.ts` |
| 08 | [Video Rendering](./docs/prds/08-video-rendering.md) | Remotion composition | `packages/remotion/` |
| 09 | [Asset Packaging](./docs/prds/09-asset-packaging.md) | Bundle & ZIP | `apps/worker/src/pipeline/steps/package-assets.ts` |
| 10 | [Credits & Billing](./docs/prds/10-credits-billing.md) | Stripe integration | `apps/api/src/` |
| 11 | [Email Notifications](./docs/prds/11-email-notifications.md) | Resend emails | `apps/worker/src/notify.ts` |

### Infrastructure Subsystems

| # | PRD | Description | Key Files |
|---|-----|-------------|-----------|
| 12 | [Database Architecture](./docs/prds/12-database-architecture.md) | PostgreSQL schema | `supabase/migrations/` |
| 13 | [Frontend UI](./docs/prds/13-frontend-ui.md) | Next.js components | `apps/web/src/` |
| 14 | [Storage & CDN](./docs/prds/14-storage-cdn.md) | Supabase Storage | - |
| 15 | [Cloud Compute](./docs/prds/15-cloud-compute.md) | Modal GPU | `modal_functions/` |
| 16 | [Shared Packages](./docs/prds/16-shared-packages.md) | Types & utils | `packages/shared/` |
| 17 | [Monitoring](./docs/prds/17-monitoring.md) | Logging & metrics | - |
| 18 | [Testing](./docs/prds/18-testing.md) | Test infrastructure | `tests/` |

---

## 4. Implementation Guides

Step-by-step guides for transforming BlankLogo into CanvasCast:

| Guide | What It Covers |
|-------|----------------|
| [impl-01-code-migration](./docs/prds/impl-01-code-migration.md) | Master checklist: KEEP, MODIFY, ADD, DELETE |
| [impl-02-api-changes](./docs/prds/impl-02-api-changes.md) | API endpoint transformations |
| [impl-03-worker-pipeline](./docs/prds/impl-03-worker-pipeline.md) | 9-step pipeline implementation |
| [impl-04-database-migration](./docs/prds/impl-04-database-migration.md) | SQL migrations for new tables |
| [impl-05-frontend-changes](./docs/prds/impl-05-frontend-changes.md) | UI components to add/modify |

---

## 5. Migration from BlankLogo

### What to KEEP (Copy As-Is)
```
BlankLogo-Source/
├── .gitignore, .nvmrc, pnpm-workspace.yaml
├── apps/web/src/lib/supabase/          # Supabase clients
├── apps/web/src/components/ui/         # shadcn components
├── apps/web/src/middleware.ts          # Auth middleware
├── apps/api/src/middleware/auth.ts     # Token auth
├── apps/api/src/lib/stripe.ts          # Stripe client
└── apps/worker/src/lib/                # Redis, Supabase
```

### What to MODIFY
```
- package.json         → Update name, add Remotion workspace
- apps/api/src/index.ts → Replace endpoints
- apps/web/src/app/    → Replace pages
- supabase/migrations/ → Add new tables
```

### What to ADD
```
+ apps/worker/src/pipeline/steps/   # 9 new step files
+ apps/web/src/app/app/jobs/[id]/   # Job progress page
+ apps/web/src/app/app/new/         # Create project page
+ packages/remotion/                 # Video composition
+ supabase/migrations/              # 6 new table migrations
```

### What to DELETE
```
- apps/worker/src/pipeline/         # Old logo pipeline
- apps/web/src/app/editor/          # Logo editor
- apps/web/src/components/logo-*    # Logo components
```

---

## 6. Environment Variables

### Required API Keys
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Redis
REDIS_URL=redis://localhost:6379

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...

# OpenAI (GPT-4, TTS, Whisper)
OPENAI_API_KEY=sk-...

# Google Gemini (Image Generation)
GEMINI_API_KEY=...

# Modal (GPU Compute) - Optional
MODAL_TOKEN=...
MODAL_ENDPOINT=...

# Resend (Email) - Optional
RESEND_API_KEY=re_...

# Internal
INTERNAL_API_TOKEN=...  # For worker→API callbacks
```

---

## 7. Development Workflow

### Directory Structure
```
CanvasCast-Target/
├── apps/
│   ├── web/           # Next.js frontend (port 3000)
│   ├── api/           # Express API (port 3001)
│   └── worker/        # BullMQ worker
├── packages/
│   ├── shared/        # Types, schemas, utils
│   └── remotion/      # Video composition
├── supabase/
│   ├── config.toml
│   └── migrations/
├── docs/
│   └── prds/          # All PRD documents
└── tests/
```

### Commands
```bash
# Development
pnpm dev              # Start all services
pnpm dev:web          # Frontend only
pnpm dev:api          # API only
pnpm dev:worker       # Worker only

# Database
pnpm supabase start   # Local Supabase
pnpm supabase db push # Apply migrations
pnpm supabase gen types typescript  # Generate types

# Testing
pnpm test             # All tests
pnpm test:unit        # Unit tests
pnpm test:e2e         # Playwright E2E

# Build
pnpm build            # Build all
pnpm typecheck        # TypeScript check
```

### Implementation Order

1. **Phase 1: Foundation**
   - Copy BlankLogo structure
   - Update package names
   - Configure environment

2. **Phase 2: Database**
   - Run new migrations
   - Test RPC functions
   - Verify RLS policies

3. **Phase 3: API**
   - Implement `/api/v1/projects`
   - Implement `/api/v1/jobs/:id/status`
   - Test credit flow

4. **Phase 4: Worker**
   - Implement pipeline runner
   - Implement each step
   - Test with mock data

5. **Phase 5: Frontend**
   - Update landing page
   - Add job progress page
   - Add credit purchase flow

6. **Phase 6: Integration**
   - End-to-end testing
   - Performance optimization
   - Production deployment

---

## Document Index

| Document | Location | Purpose |
|----------|----------|---------|
| This Handoff | `DEVELOPER_HANDOFF.md` | Master index |
| PRD Index | `docs/prds/README.md` | All PRDs listed |
| Original PRD | `PRD.md` | Initial requirements |
| Implementation Roadmap | `IMPLEMENTATION_ROADMAP.md` | High-level phases |

---

## Support

For questions about specific subsystems, refer to the corresponding PRD in `docs/prds/`.

Each PRD contains:
- Overview & business goals
- User stories
- Technical implementation with code
- System integration details
- File references
