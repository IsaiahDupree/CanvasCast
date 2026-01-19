# CanvasCast

> AI Video Generation Platform - Transform text prompts into fully produced short-form videos with AI-generated scripts, voiceover, images, and captions.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)

## Quick Start

```bash
# 1. Clone and setup
cd CanvasCast-Target
pnpm install

# 2. Setup environment
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env.local
cp apps/worker/.env.example apps/worker/.env.local
# Fill in API keys (see Environment Variables below)

# 3. Start local Supabase
pnpm supabase start

# 4. Run database migrations
pnpm supabase db push

# 5. Start development servers
pnpm dev:all
```

Visit:
- Frontend: http://localhost:3000
- API: http://localhost:8989
- Supabase Studio: http://localhost:54323

## What is CanvasCast?

CanvasCast turns text prompts into professional video content:

1. **User inputs a prompt** → AI generates a script
2. **Script → Voice** → Text-to-speech narration
3. **Script → Images** → AI-generated visuals for each scene
4. **Alignment** → Word-level timestamps for captions
5. **Rendering** → Remotion composes the final video
6. **Download** → MP4 + assets (audio, images, captions)

### Core Value Proposition

- **For first-time YouTubers**: Create professional videos without editing skills
- **For faceless channels**: Generate explainer, educational, or motivational content
- **For busy creators**: Turn notes into polished videos automatically

## Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14 (App Router), React, TailwindCSS, shadcn/ui |
| **API** | Express.js, BullMQ (Redis queue) |
| **Worker** | Node.js, BullMQ worker, Remotion, FFmpeg |
| **Database** | Supabase (PostgreSQL) |
| **Storage** | Supabase Storage (S3-compatible) |
| **Auth** | Supabase Auth (Magic Links, OAuth) |
| **Payments** | Stripe (Credits + Subscriptions) |
| **AI Services** | OpenAI (GPT-4, TTS, Whisper), Google Gemini (Imagen) |
| **Compute** | Modal (GPU for image generation) |
| **Email** | Resend |

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND (Next.js)                            │
│  Landing → Signup → Create Project → Job Progress → Download            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          API (Express.js)                                │
│  /api/v1/projects │ /api/v1/jobs/:id/status │ Stripe Webhooks           │
└─────────────────────────────────────────────────────────────────────────┘
                    │                               │
        ┌───────────┴───────────┐       ┌──────────┴──────────┐
        ▼                       ▼       ▼                      ▼
┌──────────────┐       ┌──────────────────────────┐   ┌──────────────┐
│  Redis/      │       │      Supabase            │   │   Stripe     │
│  BullMQ      │       │  PostgreSQL + Storage    │   │   Webhooks   │
└──────────────┘       └──────────────────────────┘   └──────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         WORKER (Pipeline)                                │
│  1. Script → 2. Voice → 3. Align → 4. Images → 5. Render → 6. Package  │
└─────────────────────────────────────────────────────────────────────────┘
        │
        ├──→ OpenAI (GPT-4, TTS, Whisper)
        ├──→ Google Gemini (Image Generation)
        └──→ Modal (GPU Compute)
```

### Pipeline Flow (9 Steps)

1. **Generate Script** - GPT-4 creates structured narration
2. **Generate Voice** - OpenAI TTS converts script to audio
3. **Run Alignment** - Whisper extracts word-level timestamps
4. **Plan Visuals** - Maps scenes to timestamp ranges
5. **Generate Images** - Gemini creates scene visuals
6. **Build Timeline** - Creates Remotion composition data
7. **Render Video** - Remotion renders final MP4
8. **Package Assets** - Bundles all outputs (video, audio, images, captions)
9. **Notify Complete** - Sends email and finalizes credits

## Project Structure

```
CanvasCast-Target/
├── apps/
│   ├── web/              # Next.js frontend (port 3000)
│   │   ├── src/
│   │   │   ├── app/      # App Router pages
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   └── middleware.ts
│   │   └── package.json
│   ├── api/              # Express API (port 8989)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── middleware/
│   │   │   ├── lib/
│   │   │   └── webhooks/
│   │   └── package.json
│   └── worker/           # BullMQ worker
│       ├── src/
│       │   ├── index.ts
│       │   ├── pipeline/
│       │   │   ├── runner.ts
│       │   │   └── steps/
│       │   ├── lib/
│       │   └── notify.ts
│       └── package.json
├── packages/
│   ├── shared/           # Shared types, schemas, utils
│   │   ├── src/
│   │   │   ├── types.ts
│   │   │   ├── schemas/
│   │   │   └── index.ts
│   │   └── package.json
│   └── remotion/         # Video composition
│       ├── src/
│       │   ├── compositions/
│       │   ├── components/
│       │   ├── Root.tsx
│       │   └── index.ts
│       └── package.json
├── supabase/
│   ├── config.toml
│   └── migrations/       # Database schema
├── docs/
│   ├── PRD.md
│   ├── PRD_PROMPT_TO_VIDEO.md
│   ├── DEVELOPER_HANDOFF.md
│   └── prds/             # Detailed subsystem PRDs
├── tests/                # Unit, integration, E2E tests
├── feature_list.json     # Development progress tracker
├── claude-progress.txt   # Session log
└── package.json          # Monorepo root
```

## Development

### Prerequisites

- Node.js >= 20
- pnpm >= 9.0.0
- Docker (for local Supabase)
- Supabase CLI

### Commands

```bash
# Development
pnpm dev              # Start Next.js frontend
pnpm dev:api          # Start Express API
pnpm dev:worker       # Start BullMQ worker
pnpm dev:all          # Start all services concurrently

# Database
pnpm supabase start   # Start local Supabase
pnpm supabase stop    # Stop local Supabase
pnpm supabase db push # Apply migrations
pnpm supabase gen types typescript # Generate TypeScript types

# Testing
pnpm test             # Run all tests
pnpm test:unit        # Unit tests only
pnpm test:integration # Integration tests
pnpm test:e2e         # E2E tests with Playwright
pnpm test:watch       # Watch mode
pnpm test:coverage    # With coverage report

# Build
pnpm build            # Build all apps
pnpm build:web        # Build Next.js only
pnpm build:api        # Build API only

# Linting & Type Checking
pnpm lint             # Lint all apps
pnpm typecheck        # TypeScript check
```

## Environment Variables

### Required API Keys

Create `.env.local` files in each app directory:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Redis (for BullMQ)
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
APP_BASE_URL=http://localhost:3000
```

See `.env.example` files in each app for complete lists.

## Data Model

### Key Tables

- **profiles** - User profiles (linked to auth.users)
- **draft_prompts** - Pre-auth prompt capture
- **projects** - User video projects
- **jobs** - Pipeline job queue and status
- **job_steps** - Per-step tracking and logs
- **assets** - Generated files (video, audio, images, captions)
- **credit_ledger** - Credit transactions (purchase, reserve, spend, refund)
- **subscriptions** - Stripe subscription tracking

### Credit System

Credits use a **ledger pattern**:
- `purchase` - User buys credits via Stripe
- `reserve` - Credits held when job starts
- `release` - Credits returned if job fails
- `spend` - Final cost deducted on success
- `refund` - Admin refunds
- `admin_adjust` - Manual adjustments

**Pricing**: 1 credit = 1 minute of video output

## Features & Progress

### MVP Scope (156 features)

Progress is tracked in `feature_list.json` with the following structure:

```json
{
  "id": "FOUND-001",
  "name": "Feature Name",
  "description": "What it does",
  "priority": "P0",
  "phase": 1,
  "effort": "2h",
  "passes": false,
  "category": "foundation",
  "files": ["path/to/file.ts"],
  "acceptance": ["Criteria 1", "Criteria 2"]
}
```

**Priority Levels**:
- **P0** (106 features) - Critical for MVP
- **P1** (39 features) - Important for production
- **P2** (11 features) - Nice to have

**Development Phases**:
1. Foundation (5 features) - Monorepo, shared packages
2. Database (15 features) - Schema, RLS, RPC functions
3. Authentication (8 features) - Auth flows, middleware
4. Draft System (3 features) - Pre-auth prompt capture
5. API (13 features) - Express server, endpoints
6. Worker (4 features) - BullMQ orchestration
7. Pipeline Steps (14 features) - Video generation steps
8. Frontend (17 features) - UI, pages, components
9. Billing (6 features) - Stripe integration
10. Email (7 features) - Transactional notifications
11. Storage (3 features) - Asset management
12. Testing & Deploy (11 features) - Tests, CI/CD

### Current Status

**Completed**: 0 / 156 features (0%)

See `claude-progress.txt` for session-by-session progress logs.

## Documentation

| Document | Purpose |
|----------|---------|
| `README.md` | This file - project overview |
| `DEVELOPER_HANDOFF.md` | Complete developer onboarding guide |
| `feature_list.json` | Detailed feature tracking |
| `claude-progress.txt` | Session-by-session progress log |
| `docs/PRD.md` | Original product requirements |
| `docs/PRD_PROMPT_TO_VIDEO.md` | Detailed prompt-to-video flow PRD |
| `docs/prds/` | 18 subsystem PRDs with implementation details |

## Deployment

### Production Services

- **Frontend + API**: Deploy to Render, Vercel, or Railway
- **Worker**: Deploy to Render, Railway, or dedicated VM
- **Database**: Supabase Cloud (production tier)
- **Storage**: Supabase Storage or R2/S3
- **Redis**: Redis Cloud or Upstash
- **Monitoring**: Sentry (errors) + PostHog (analytics)

### Deployment Checklist

- [ ] Set up production Supabase project
- [ ] Configure Stripe production keys
- [ ] Set up Redis instance
- [ ] Configure environment variables
- [ ] Set up DNS and domain
- [ ] Configure CORS origins
- [ ] Set up monitoring (Sentry, PostHog)
- [ ] Configure email service (Resend)
- [ ] Test end-to-end flow
- [ ] Set up CI/CD pipeline

## Contributing

### For Autonomous Agents

1. Read `DEVELOPER_HANDOFF.md` for complete context
2. Check `feature_list.json` for next task
3. Implement feature following acceptance criteria
4. Update `passes: true` when complete
5. Log progress in `claude-progress.txt`
6. Write tests for new functionality

### Testing Requirements

- All new features must have unit tests
- API endpoints must have integration tests
- Critical user flows must have E2E tests
- Pipeline steps must have mocked external API calls

## Support

For questions about specific subsystems, refer to:
- `docs/prds/` - Detailed PRDs for each subsystem
- `DEVELOPER_HANDOFF.md` - Complete architecture overview
- `feature_list.json` - Implementation checklist

## License

MIT

---

**Status**: 🚧 In Development | **Version**: 1.0 MVP | **Last Updated**: 2026-01-18
