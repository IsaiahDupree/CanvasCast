# CanvasCast Subsystem PRDs

This directory contains detailed Product Requirements Documents for each subsystem of the CanvasCast application. Each PRD includes functional requirements, data models, API contracts, and **system integration details** showing how subsystems communicate with each other.

## Index

| # | Subsystem | Status | Description |
|---|-----------|--------|-------------|
| 00 | [System Integration](./00-system-integration.md) | 📘 Reference | Master integration architecture |
| 01 | [Draft/Prompt System](./01-draft-prompt-system.md) | ✅ Implemented | Pre-auth prompt capture and restoration |
| 02 | [Authentication](./02-authentication-system.md) | ✅ Implemented | Supabase Auth, magic links, OAuth |
| 03 | [Job Pipeline](./03-job-pipeline-orchestration.md) | ✅ Implemented | BullMQ queue, 9-step orchestration |
| 04 | [Script Generation](./04-script-generation.md) | ✅ Implemented | LLM-based script creation |
| 05 | [Voice Generation](./05-voice-generation.md) | ✅ Implemented | TTS via OpenAI/ElevenLabs |
| 06 | [Alignment](./06-alignment-system.md) | ✅ Implemented | Whisper word-level timestamps |
| 07 | [Image Generation](./07-image-generation.md) | ✅ Implemented | Gemini Imagen visuals |
| 08 | [Video Rendering](./08-video-rendering.md) | ✅ Implemented | Remotion composition |
| 09 | [Asset Packaging](./09-asset-packaging.md) | ✅ Implemented | Bundle, upload, ZIP |
| 10 | [Credits & Billing](./10-credits-billing.md) | ✅ Implemented | Stripe payments, credit system |
| 11 | [Email Notifications](./11-email-notifications.md) | ✅ Implemented | Transactional emails via Resend |
| 12 | [Database Architecture](./12-database-architecture.md) | ✅ Implemented | PostgreSQL schema, RLS, migrations |
| 13 | [Frontend UI](./13-frontend-ui.md) | ✅ Implemented | Next.js App Router, React components |
| 14 | [Storage & CDN](./14-storage-cdn.md) | ✅ Implemented | Supabase Storage, file lifecycle |
| 15 | [Cloud Compute](./15-cloud-compute.md) | ✅ Implemented | Modal GPU functions, serverless |
| 16 | [Shared Packages](./16-shared-packages.md) | ✅ Implemented | Types, schemas, utilities |
| 17 | [Monitoring](./17-monitoring.md) | 📋 Planned | Logging, metrics, alerting |
| 18 | [Testing](./18-testing.md) | ✅ Implemented | Unit, integration, E2E tests |

## Implementation Guides

These PRDs detail what to pull from BlankLogo-Source and what changes to make:

| # | Guide | Description |
|---|-------|-------------|
| impl-01 | [Code Migration](./impl-01-code-migration.md) | What to keep, modify, add from BlankLogo |
| impl-02 | [API Changes](./impl-02-api-changes.md) | Endpoint transformations & new routes |
| impl-03 | [Worker Pipeline](./impl-03-worker-pipeline.md) | 9-step pipeline replacement |
| impl-04 | [Database Migration](./impl-04-database-migration.md) | Schema changes & new tables |
| impl-05 | [Frontend Changes](./impl-05-frontend-changes.md) | UI components & pages to modify/add |

## PRD Structure

Each subsystem PRD contains:

1. **Overview** - Purpose and business goals
2. **User Stories** - Who uses it and why
3. **Functional Requirements** - What it does
4. **Data Model** - Database schema
5. **API Contracts** - Request/response formats
6. **Error Handling** - Failure modes and recovery
7. **Configuration** - Environment variables
8. **Metrics** - Monitoring and observability
9. **Files** - Code file references
10. **System Integration** ⭐ - How it communicates with other subsystems

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Landing   │  │    Auth     │  │  Dashboard  │  │  Job Status │    │
│  │  + Prompt   │  │ Login/Signup│  │  Projects   │  │   Stepper   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                               API                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Draft   │  │ Projects │  │   Jobs   │  │ Credits  │  │  Stripe  │  │
│  │   API    │  │   CRUD   │  │  Status  │  │ Balance  │  │ Webhooks │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌──────────────────────────┐       ┌──────────────────────────────────────┐
│         Redis            │       │              Supabase                 │
│  ┌────────────────────┐  │       │  ┌────────────┐  ┌────────────────┐  │
│  │   BullMQ Queue     │  │       │  │  Postgres  │  │    Storage     │  │
│  │  video-generation  │  │       │  │   + Auth   │  │  + CDN         │  │
│  └────────────────────┘  │       │  └────────────┘  └────────────────┘  │
└──────────────────────────┘       └──────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                             WORKER                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Pipeline Runner                             │   │
│  │  1. SCRIPTING    → LLM script generation                        │   │
│  │  2. VOICE_GEN    → TTS narration                                │   │
│  │  3. ALIGNMENT    → Whisper timestamps                           │   │
│  │  4. VISUAL_PLAN  → Scene layout                                 │   │
│  │  5. IMAGE_GEN    → Gemini images                                │   │
│  │  6. TIMELINE     → Remotion timeline                            │   │
│  │  7. RENDERING    → Video render                                 │   │
│  │  8. PACKAGING    → Upload + ZIP                                 │   │
│  │  9. READY        → Notify user                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
User Prompt → Draft (pre-auth) → Signup → Project → Job → Pipeline → Assets → Download
     │              │               │         │        │        │         │
     └── PRD 01 ────┘               │         │        │        │         │
                                    └── PRD 02┘        │        │         │
                                                       └ PRD 03 ┘         │
                                                                          │
                              PRD 04-08 (Script, Voice, Align, Images, Render)
                                                                          │
                                                            PRD 09 (Package)
```

## Key Technologies

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React, TailwindCSS |
| API | Express.js, BullMQ |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Queue | Redis + BullMQ |
| LLM | OpenAI GPT-4 / Anthropic Claude |
| TTS | OpenAI TTS / ElevenLabs |
| Alignment | OpenAI Whisper |
| Images | Google Gemini Imagen |
| Video | Remotion |
| Payments | Stripe |
| Email | Resend |

## Environment Variables

See each PRD for subsystem-specific configuration. Key variables:

```bash
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_ANON_KEY=

# Redis
REDIS_URL=

# LLM
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# TTS
ELEVENLABS_API_KEY=

# Images
GEMINI_API_KEY=

# Payments
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Email
RESEND_API_KEY=
```

## Getting Started

```bash
# Install dependencies
pnpm install

# Start Supabase locally
pnpm db:start

# Run migrations
pnpm db:migrate

# Start all services
pnpm dev:all
```

## Contributing

When adding new features:
1. Create/update the relevant PRD
2. Add database migrations if needed
3. Implement API endpoints
4. Add worker pipeline steps
5. Build frontend UI
6. Write tests
