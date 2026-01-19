# PRD Gap Analysis

> **Generated:** Jan 19, 2026  
> **Purpose:** Track implementation status against PRD requirements for MVP launch readiness

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [PRD.md — Core CanvasCast Features](#prdmd--core-canvascast-features)
3. [PRD_PROMPT_TO_VIDEO.md — Prompt-to-Video Flow](#prd_prompt_to_videomd--prompt-to-video-flow)
4. [INFRASTRUCTURE_PRD.md — Technical Infrastructure](#infrastructure_prdmd--technical-infrastructure)
5. [Critical Gaps for MVP Launch](#critical-gaps-for-mvp-launch)
6. [Recommended Priority Order](#recommended-priority-order)

---

## Executive Summary

| Category | ✅ Done | ⚠️ Partial | ❌ Not Started |
|----------|---------|------------|----------------|
| Core Pipeline | 12 | 2 | 0 |
| Infrastructure | 10 | 2 | 0 |
| User Features | 8 | 4 | 4 |
| Monetization | 4 | 0 | 0 |

**Overall MVP Readiness: ~75-80%**

---

## PRD.md — Core CanvasCast Features

### ✅ Completed

| Feature | Implementation | File/Location |
|---------|----------------|---------------|
| Database schema + RLS | 9 migrations applied | `supabase/migrations/` |
| Monorepo structure | apps/web, apps/worker, packages/shared | Root directory |
| Job queue + polling | Worker with claim/stale recovery | `apps/worker/src/index.ts` |
| Pipeline state machine | SCRIPTING → TTS → ALIGNMENT → VISUALS → RENDERING → PACKAGING → READY | `apps/worker/src/pipeline/runner.ts` |
| Script generation | LLM-based script generation | `apps/worker/src/pipeline/steps/generate-script.ts` |
| TTS narration | Multiple TTS providers supported | `apps/worker/src/pipeline/steps/generate-voice.ts` |
| Image generation | DALL-E / image gen | `apps/worker/src/pipeline/steps/generate-images.ts` |
| Alignment (captions) | Whisper-based word-level alignment | `apps/worker/src/pipeline/steps/run-alignment.ts` |
| Timeline JSON | Deterministic render spec | `apps/worker/src/pipeline/steps/build-timeline.ts` |
| Remotion assembly | Video rendering in worker | `apps/worker/src/pipeline/steps/render-video.ts` |
| Asset packaging | MP4 + SRT + VTT + ZIP | `apps/worker/src/pipeline/steps/package-assets.ts` |
| Credit ledger system | Append-only ledger with reserve/spend/refund | `supabase/migrations/*credit*` |
| Supabase Auth | Server + client auth | `apps/web/src/lib/supabase/` |
| Stripe integration | Checkout, webhooks, portal | `apps/web/src/app/api/stripe/` |
| Dashboard UI | Authenticated app routes | `apps/web/src/app/app/` |

### ⚠️ Partial / In Progress

| Feature | Gap Description | Action Required |
|---------|-----------------|-----------------|
| Email notifications (Resend) | `TODO` comments in `runner.ts` lines 200, 244 | Implement `sendJobCompletedEmail()` and `sendJobFailedEmail()` |
| Job status UI | Pages exist but need real-time polling verification | Verify polling interval (2-5 sec per PRD) works end-to-end |
| Niche presets | Referenced in PRD but not visible in codebase | Create preset data + UI selector |
| Hook variations | PRD lists as "Should-Have" MVP+ | Defer or implement 3-hook generation |

### ❌ Not Started (Post-MVP or Gated)

| Feature | PRD Section | Notes |
|---------|-------------|-------|
| Voice profiles (bring your voice) | Flow B in PRD.md | API route stub exists, implementation deferred |
| BGM library | Should-Have MVP+ | Not critical for launch |
| Template pacing controls | Should-Have MVP+ | Not critical for launch |
| YouTube upload | Nice-to-Have | Explicitly excluded from MVP |
| Team workspaces | Nice-to-Have | Post-MVP |
| Brand kit | Nice-to-Have | Post-MVP |

---

## PRD_PROMPT_TO_VIDEO.md — Prompt-to-Video Flow

### ✅ Completed

| Functional Requirement | Implementation | Location |
|------------------------|----------------|----------|
| FR-1: Draft prompt saving (pre-auth) | `draft_prompts` table + `claim_draft_prompt()` | `supabase/migrations/20260118000000_draft_prompts_job_steps.sql` |
| FR-2: Job creation + credit gating | Credit reservation on job start | `apps/web/src/app/api/projects/[id]/jobs/route.ts` |
| FR-4: Scene plan JSON | Visual planning step | `apps/worker/src/pipeline/steps/plan-visuals.ts` |
| FR-5: Image generation | With retry logic | `apps/worker/src/pipeline/steps/generate-images.ts` |
| FR-6: Voice TTS | Multiple providers | `apps/worker/src/pipeline/steps/generate-voice.ts` |
| FR-7: Word-level alignment | Whisper-based | `apps/worker/src/pipeline/steps/run-alignment.ts` |
| FR-8: Remotion rendering | Worker container render | `apps/worker/src/pipeline/steps/render-video.ts` |
| FR-9: Packaging + delivery | MP4, SRT, VTT, images, ZIP, manifest | `apps/worker/src/pipeline/steps/package-assets.ts` |
| Job state machine | Matches PRD spec | `apps/worker/src/pipeline/runner.ts` |
| Trial credit grant | 10 credits on signup | `supabase/migrations/20260118000000_draft_prompts_job_steps.sql` |
| `job_steps` tracking | Granular step progress | `supabase/migrations/20260118000000_draft_prompts_job_steps.sql` |

### ⚠️ Partial

| Requirement | Gap | Action Required |
|-------------|-----|-----------------|
| Screen A-E UX flow | Pages exist, need UX verification | Manual test of full flow: Landing → Signup → Create → Status → Result |
| FR-3: Transcript modes | `transcript_mode` column exists | Verify UI shows "Auto-generate" vs "Paste my transcript" toggle |
| FR-10: Status updates (detailed) | `job_steps` + `job_events` exist | Verify UI polls and displays step-by-step progress |
| Email delivery when READY | `TODO` in runner.ts | Implement Resend email on job completion |

### ❌ V1 Features (Deferred)

| Feature | PRD Section | Notes |
|---------|-------------|-------|
| Upload transcript | Phase 1 | User provides their own transcript |
| Upload narration audio | Phase 1 | Skip TTS, use user audio |
| Consistent character reference | Phase 1 | Reference image for subject consistency |
| Stickers overlay | Phase 1 | Word-anchor based overlays |

---

## INFRASTRUCTURE_PRD.md — Technical Infrastructure

### ✅ Completed

| Component | Implementation | Notes |
|-----------|----------------|-------|
| Monorepo structure | Exact match to spec | pnpm workspaces |
| Database schema | All core tables present | projects, jobs, assets, credit_ledger, profiles |
| Auth middleware | Protected /app routes | `apps/web/src/middleware.ts` |
| Stripe checkout | Session creation | `apps/web/src/app/api/stripe/checkout/route.ts` |
| Stripe webhooks | Payment + subscription events | `apps/web/src/app/api/stripe/webhook/route.ts` |
| Stripe portal | Customer self-service | `apps/web/src/app/api/stripe/portal/route.ts` |
| Worker polling | With stale job recovery | `apps/worker/src/index.ts` |
| Storage architecture | `project-assets/`, `project-outputs/` | Path helpers in `pipeline/types.ts` |
| Testing infrastructure | 17 e2e specs + unit/integration | `tests/` directory |
| Database functions | `claim_next_job`, credit functions | Various migrations |
| Dockerfile for worker | Railway deployment ready | `apps/worker/Dockerfile` |

### ⚠️ Partial

| Component | Gap | Action Required |
|-----------|-----|-----------------|
| Resend email integration | Lib exists, send logic incomplete | Complete email templates + send functions |
| Meta Ads integration | Listed in PRD TOC | Implement if needed for launch tracking |

---

## Critical Gaps for MVP Launch

### 🔴 P0 — Must Fix Before Launch

| Gap | Impact | Effort | Owner |
|-----|--------|--------|-------|
| **Email notifications** | Users won't know when video is ready | Medium | — |
| **End-to-end flow test** | Could have broken user journey | Low | — |
| **Real-time status polling** | Users can't see progress | Low | — |

### 🟡 P1 — Should Fix Before Launch

| Gap | Impact | Effort | Owner |
|-----|--------|--------|-------|
| **Niche presets** | Missing core PRD feature | Medium | — |
| **Transcript mode UI** | Users can't paste own transcript | Low | — |
| **Download page polish** | UX quality | Low | — |

### 🟢 P2 — Can Defer to Post-Launch

| Gap | Impact | Notes |
|-----|--------|-------|
| Hook variations | Nice-to-have | Can add later |
| Voice profiles | Gated feature | Requires consent flow |
| BGM library | Enhancement | Not critical |
| Template pacing | Enhancement | Default pacing works |

---

## Recommended Priority Order

```
Week 1: Critical Path
├── [ ] Implement email notifications (Resend)
│   ├── Job completed email
│   └── Job failed email
├── [ ] Verify real-time status UI polling
└── [ ] End-to-end manual QA test

Week 2: Feature Completeness
├── [ ] Add niche presets data + UI
├── [ ] Transcript mode toggle in Create UI
└── [ ] Polish download/result page

Week 3: Launch Prep
├── [ ] Load testing
├── [ ] Error monitoring (Sentry)
└── [ ] Analytics events (PostHog)
```

---

## Appendix: File References

### Key Implementation Files

| Purpose | Path |
|---------|------|
| Pipeline runner | `apps/worker/src/pipeline/runner.ts` |
| Job claiming | `apps/worker/src/lib/claim.ts` |
| Stripe checkout | `apps/web/src/app/api/stripe/checkout/route.ts` |
| Auth middleware | `apps/web/src/middleware.ts` |
| Dashboard layout | `apps/web/src/app/app/layout.tsx` |
| DB migrations | `supabase/migrations/` |

### PRD Documents

| Document | Path |
|----------|------|
| Core PRD | `docs/PRD.md` |
| Prompt-to-Video PRD | `docs/PRD_PROMPT_TO_VIDEO.md` |
| Infrastructure PRD | `docs/INFRASTRUCTURE_PRD.md` |

---

*Last updated: Jan 19, 2026*
