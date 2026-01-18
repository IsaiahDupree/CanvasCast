# PRD — Prompt-to-Video Generator (MVP "One Format")

**Doc owner:** Isaiah  
**Version:** v0.1 (MVP-first)  
**Date:** Jan 17, 2026  
**Product type:** Web app (auth + credits) + background video pipeline + email delivery

---

## 1) Summary

### One-liner
Users enter a prompt → we generate a video (MP4) + downloadable assets (images, audio, captions) → we show detailed step-by-step status → we email when ready → 1 free trial video → credits/subscription for more.

### Primary Goals (MVP)
- Convert "cold traffic" into first render with minimal friction (draft save before auth)
- Deliver a complete output package reliably: MP4 + asset bundle + timestamps
- Make rendering feel trustworthy with clear progress + email delivery
- Monetize with credits + subscription after the first free render

### Non-goals (MVP)
- Multiple formats/templates (we start with one)
- True "text-to-video b-roll generation" (use images/storyboard instead)
- Real-time editing timeline UI (we generate; users download)

---

## 2) MVP Format Definition

### "Narrated Storyboard + Captions" (recommended)
- 6–12 scenes
- Each scene = generated image + on-screen caption + simple motion (Ken Burns / pan / zoom)
- Voiceover narration + word-synced captions
- Optional sticker overlays (V1 add-on)

**Why:** fast to render, high perceived value, short-form friendly, doesn't require heavy video-gen.

---

## 3) UX / Screens (MVP)

### Screen A — Landing (no auth)

**Elements:**
- Prompt input (multi-line)
- "Try an example" dropdown
- CTA: **Generate Free Video**
- Microcopy: "1 free render. We'll save your prompt."

**Behavior:**
- On submit: create Draft Prompt tied to anonymous session token → route to Signup Gate

### Screen B — Signup Gate (prompt saved)

**Elements:**
- "Your prompt is saved."
- Auth: email magic link / Google
- Small preview of prompt (collapsed)

**Behavior:**
- After auth: attach draft to user → route to Create page (with prompt restored)

### Screen C — Create (post-auth prompt editor)

**Sections:**
- Prompt editor (restored draft, editable)
- Transcript (tabs):
  - "Auto-generate from prompt" (default)
  - "Paste my transcript"
- Voice:
  - Default TTS (default)
  - Upload voice audio (V1)
- Consistent Character:
  - Upload reference image (V1)
- Stickers:
  - Upload sticker set (V1)
- CTA: **Generate Video** (shows credit cost)

### Screen D — Job Status (live)

**Shows a stepper:**
1. Queued
2. Scripting
3. Scene Planning
4. Image Gen
5. Voice Gen
6. Alignment
7. Rendering
8. Packaging
9. Ready

Each step shows: short explanation + percent + latest log line (friendly).

**User options:**
- "Email me when ready" (default ON)
- "Leave this page — we'll email you."

### Screen E — Result (Ready)

**Outputs:**
- MP4 player
- Download buttons:
  - MP4
  - Captions (SRT + VTT)
  - Audio (WAV/MP3)
  - Images (zip)
  - Full assets pack zip
  - Manifest JSON

**Also:**
- "Generate another" (consumes credits)
- "Duplicate settings" (quick rerun)

### Screen F — Billing / Credits
- Trial shows: "1 free render remaining / used"
- Credit packs + subscription plans
- Purchase history

---

## 4) Functional Requirements + Acceptance Criteria

### FR-1: Draft prompt saving (pre-auth)

**User story:** As a new visitor, I can generate without signing up first, and my prompt is saved.

**Acceptance criteria:**
- Given I'm not logged in, when I click "Generate Free Video", then my prompt is stored as a Draft tied to a session token
- When I complete signup/login, then the draft prompt is restored in the editor
- Draft expires after X days (e.g., 7) unless attached to user

**Edge cases:**
- User opens a new device → draft not available unless they sign up before leaving (OK)
- Multiple drafts in same session → keep most recent + list previous (optional)

### FR-2: Job creation + credit gating

**User story:** As a user, I can create a video job and see it progress.

**Acceptance criteria:**
- Given I have a free trial credit (or paid credits), when I click "Generate Video", then a Job is created with state QUEUED
- Credits are reserved at job start; if job fails before rendering, credits are refunded (configurable policy)
- If I have 0 credits, CTA routes me to Billing

### FR-3: Transcript generation (MVP)

**User story:** I can either paste a transcript or have one generated.

**Acceptance criteria:**
- If "Auto-generate transcript" selected: system produces a structured script output (with narration + scene beats)
- If "Paste transcript" selected: system uses it as narration source

### FR-4: Scene plan JSON (MVP)

**User story:** The system turns transcript into scenes suitable for rendering.

**Acceptance criteria:**
- Output includes scene list with durations OR target word ranges, plus image prompts + on-screen captions
- Must be valid JSON against schema (below)
- Total video length respects template limits (e.g., 20–60 seconds default)

### FR-5: Image generation (MVP + V1 consistency)

**MVP acceptance criteria:**
- For each scene, generate one image asset and store URL
- If any image gen fails, retry up to N times; if still failing, mark job failed with reason

**V1 consistency acceptance criteria:**
- If user provides a character reference, pipeline uses it to maintain consistent subject identity across scenes

### FR-6: Voice (MVP TTS)

**Acceptance criteria:**
- Default: generate narration audio using chosen TTS voice
- Audio is stored and linked to job assets

**V1 user voice upload:**
- User can upload their own narration audio (skip TTS)
- System still runs alignment to get word timings

### FR-7: Word-level timestamp alignment

**User story:** Captions should match spoken words and scene cuts shouldn't feel "off."

**Acceptance criteria:**
- System produces word-level timestamps for the final narration audio
- Captions export to SRT + VTT
- Remotion scene transitions use timestamp anchors (word index/time) rather than naive fixed durations

### FR-8: Rendering (Remotion)

**Key constraint:** Rendering inside Vercel Serverless functions isn't viable due to size limits and Chromium dependency.

**Acceptance criteria:**
- Rendering runs in a worker environment (Modal container recommended)
- Output MP4 meets template spec (resolution, fps, duration)
- If render fails, job transitions to FAILED with error log attached

### FR-9: Packaging + delivery

**Acceptance criteria:**
- System produces:
  - `video.mp4`
  - `audio.wav` or `audio.mp3`
  - `captions.srt`, `captions.vtt`
  - `/images/scene_001.png` ...
  - `manifest.json`
  - `assets.zip` containing everything
- Email is sent when job becomes READY, with a dashboard link

### FR-10: Status updates (detailed + trustworthy)

**Acceptance criteria:**
- Job state machine persists step + percent + message
- UI polls `/jobs/:id` and shows updates at least every 2–5 seconds
- Step logs available (even if only last ~20 lines)

---

## 5) System Architecture (BlankLogo-style)

### Recommended Deployment
- **Web + API:** Next.js on Render (or similar)
- **DB/Auth/Storage:** Supabase (Postgres + Storage) or R2/S3 for large assets
- **Worker compute:** Modal (pipeline + rendering)
- **Email:** Resend/Postmark
- **Analytics:** PostHog + Sentry

### High-level Diagram
```
User (Web) 
  -> Next.js (Render) 
      -> Supabase (Auth + DB)
      -> Storage (Supabase or R2/S3)
      -> Create Job (DB)
      -> Trigger Worker (Modal)

Modal Worker
  -> Script + ScenePlan
  -> Image Gen (Gemini Nano Banana via Gemini API)
  -> TTS (HF / other)
  -> Alignment (word timestamps)
  -> Remotion Render (Chromium in container)
  -> Upload assets + zip
  -> Update Job READY

Next.js
  -> Email "Ready"
  -> Dashboard download
```

### Job State Machine
```
QUEUED → SCRIPTING → SCENE_PLANNING → IMAGE_GEN → VOICE_GEN → ALIGNMENT → RENDERING → UPLOAD_PACKAGING → READY
                                                                                                        ↓
Failure at any step → FAILED (with failed_step, error_code, error_message)
```

---

## 6) Data Model (Supabase)

### Tables (MVP)

#### draft_prompts
| Column | Type |
|--------|------|
| id | uuid |
| session_token | text |
| prompt_text | text |
| created_at | timestamptz |
| claimed_by_user_id | uuid (nullable) |

#### projects
| Column | Type |
|--------|------|
| id | uuid |
| user_id | uuid |
| title | text |
| prompt_text | text |
| transcript_text | text (nullable) |
| template_id | text |
| options_json | jsonb |
| created_at | timestamptz |

#### jobs
| Column | Type |
|--------|------|
| id | uuid |
| project_id | uuid |
| user_id | uuid |
| state | text |
| progress_pct | int |
| status_message | text |
| failed_step | text (nullable) |
| error_json | jsonb (nullable) |
| created_at | timestamptz |
| started_at | timestamptz |
| finished_at | timestamptz |

#### job_steps
| Column | Type |
|--------|------|
| id | uuid |
| job_id | uuid |
| step_name | text |
| state | text (started/succeeded/failed) |
| started_at | timestamptz |
| finished_at | timestamptz |
| logs_url | text (nullable) |

#### assets
| Column | Type |
|--------|------|
| id | uuid |
| job_id | uuid |
| type | text (video, audio, image, captions, zip, manifest) |
| url | text |
| metadata_json | jsonb |

#### credits_ledger
| Column | Type |
|--------|------|
| id | uuid |
| user_id | uuid |
| delta | int |
| reason | text (trial_grant, job_reserve, job_refund, purchase) |
| job_id | uuid (nullable) |
| created_at | timestamptz |

---

## 7) API Contract (MVP)

### Draft
```
POST /api/draft
body: { promptText }
returns: { draftId }
```

### Project + Job
```
POST /api/projects
body: { promptText, transcriptMode, transcriptText?, templateId, options }
returns: { projectId }

POST /api/projects/:projectId/jobs
returns: { jobId }
```

### Status
```
GET /api/jobs/:jobId
returns:
{
  "jobId": "…",
  "state": "RENDERING",
  "progressPct": 62,
  "statusMessage": "Rendering scene 7/10…",
  "steps": [{ "name": "IMAGE_GEN", "state": "succeeded" }],
  "assets": [{ "type": "image", "url": "…" }]
}
```

### Billing Webhooks
```
POST /api/webhooks/stripe
```

---

## 8) JSON Schemas (copy/paste ready)

### 8.1 scene_plan.json
```json
{
  "version": "1.0",
  "templateId": "narrated_storyboard_v1",
  "video": { "width": 1080, "height": 1920, "fps": 30 },
  "narration": {
    "text": "Full narration text…",
    "voice": { "provider": "tts_default", "voiceId": "alloy" }
  },
  "scenes": [
    {
      "sceneId": "s1",
      "title": "Hook",
      "caption": "Stop doing this with your ads…",
      "imagePrompt": "Cinematic close-up of…",
      "visualStyle": "clean, high-contrast, short-form",
      "timing": {
        "mode": "anchor_words",
        "startWordIndex": 0,
        "endWordIndex": 28
      },
      "overlays": [
        { "type": "sticker", "stickerId": "laugh", "enterWordIndex": 10, "exitWordIndex": 18 }
      ]
    }
  ]
}
```

### 8.2 transcript_alignment.json (word timing)
```json
{
  "text": "…",
  "words": [
    { "w": "Stop", "t0": 0.12, "t1": 0.34 },
    { "w": "doing", "t0": 0.35, "t1": 0.58 }
  ]
}
```

### 8.3 manifest.json (final output)
```json
{
  "jobId": "…",
  "templateId": "narrated_storyboard_v1",
  "render": { "durationSec": 42.1, "fps": 30, "resolution": "1080x1920" },
  "assets": {
    "videoMp4": "https://…/video.mp4",
    "audio": "https://…/audio.wav",
    "captionsSrt": "https://…/captions.srt",
    "captionsVtt": "https://…/captions.vtt",
    "images": ["https://…/scene_001.png"],
    "zip": "https://…/assets.zip"
  },
  "debug": {
    "scenePlanUrl": "https://…/scene_plan.json",
    "alignmentUrl": "https://…/alignment.json"
  }
}
```

---

## 9) Modal Worker Design (how the pipeline runs)

### Worker Entrypoint
```
start_job(jobId)
```

1. Load project + options from DB
2. Update job → SCRIPTING
3. Generate transcript (or use provided)
4. Update job → SCENE_PLANNING
5. Create scene_plan.json
6. Update job → IMAGE_GEN
7. Generate scene images (optionally with reference images for consistency)
8. Update job → VOICE_GEN
9. Generate narration audio (or ingest uploaded audio)
10. Update job → ALIGNMENT
11. Produce word timestamps JSON
12. Update job → RENDERING
13. Render with Remotion in-container (Chromium)
14. Update job → UPLOAD_PACKAGING
15. Upload assets + zip + manifest
16. Update job → READY
17. Call web app callback (or DB trigger) → send email

---

## 10) Analytics (PostHog events that matter)

### Acquisition → Activation
- `landing_prompt_submitted`
- `draft_created`
- `signup_started`
- `signup_completed`
- `project_created`
- `job_started`
- `job_step_changed` (properties: step, state, pct)
- `job_ready`
- `asset_downloaded` (type)
- `trial_consumed`

### Monetization
- `billing_viewed`
- `checkout_started`
- `checkout_completed`
- `credits_added`
- `subscription_started`
- `subscription_canceled`

### Quality Signals
- `job_failed` (step, error_code)
- `render_duration_ms`
- `image_gen_retry_count`
- `time_to_ready_sec`

---

## 11) Rollout Plan

### Phase 0 — MVP
- [ ] Draft saving + signup restore
- [ ] One template
- [ ] TTS voice
- [ ] Scene images
- [ ] Alignment
- [ ] Remotion render
- [ ] Status UI + email delivery
- [ ] 1 trial credit + paid credits

### Phase 1 — Power Features
- [ ] Upload transcript
- [ ] Upload narration audio
- [ ] Consistent character reference image workflow
- [ ] Stickers (overlay timeline from word anchors)

---

## 12) Risks + Mitigations

### Render reliability / Chromium headaches
**Mitigate:** containerize Remotion render; cap video length; enforce template constraints.

### Image consistency expectations too high
**Mitigate:** set UX expectation: "Consistency improves when you provide a reference image."

### Costs spike
**Mitigate:** hard caps (max scenes, max length), credit pricing tied to compute, caching per scene.

### User-uploaded voice/images (abuse)
**Mitigate:** consent checkbox, rate limits, moderation, audit logs.
