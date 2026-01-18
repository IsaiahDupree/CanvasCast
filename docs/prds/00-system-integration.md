# System Integration & Communication Architecture

**Document:** Master Integration PRD  
**Version:** 1.0  
**Status:** Reference  
**Owner:** Isaiah  

---

## 1. System Overview

CanvasCast is composed of 11 interconnected subsystems that work together to transform user prompts into rendered videos. This document defines how each subsystem communicates with others.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 USER LAYER                                       │
│   Browser ──► Next.js Frontend ──► API Routes ──► Express API                   │
└─────────────────────────────────────────────────────────────────────────────────┘
                          │                    │
          ┌───────────────┴───────────────┐    │
          ▼                               ▼    ▼
┌──────────────────┐            ┌──────────────────────────────────────────────────┐
│   Supabase Auth  │            │                  DATA LAYER                       │
│  ┌────────────┐  │            │  ┌────────────┐  ┌─────────┐  ┌───────────────┐  │
│  │  Sessions  │  │            │  │  Postgres  │  │  Redis  │  │    Storage    │  │
│  │   Tokens   │  │            │  │   Tables   │  │  Queue  │  │  (R2/S3/CDN)  │  │
│  └────────────┘  │            │  └────────────┘  └─────────┘  └───────────────┘  │
└──────────────────┘            └──────────────────────────────────────────────────┘
                                              │
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              WORKER LAYER                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                         Pipeline Runner                                  │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │    │
│  │  │ Script   │→│  Voice   │→│ Whisper  │→│  Image   │→│ Remotion │      │    │
│  │  │   LLM    │ │   TTS    │ │ Alignment│ │   Gen    │ │  Render  │      │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘      │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL SERVICES                                      │
│  ┌─────────┐  ┌─────────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐           │
│  │ OpenAI  │  │ ElevenLabs  │  │ Gemini  │  │ Stripe  │  │ Resend  │           │
│  │GPT + TTS│  │    TTS      │  │ Imagen  │  │Payments │  │  Email  │           │
│  └─────────┘  └─────────────┘  └─────────┘  └─────────┘  └─────────┘           │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Communication Patterns

### 2.1 Synchronous (Request/Response)

| From | To | Protocol | Use Case |
|------|----|----------|----------|
| Frontend | API | HTTP/REST | User actions, data fetching |
| Frontend | Supabase | HTTP/REST | Auth, direct DB queries |
| API | Supabase | HTTP/REST | CRUD operations |
| API | Stripe | HTTP/REST | Payment operations |
| Worker | External APIs | HTTP/REST | LLM, TTS, Image gen |

### 2.2 Asynchronous (Queue-Based)

| From | To | Mechanism | Use Case |
|------|----|-----------|----------|
| API | Worker | Redis/BullMQ | Job dispatch |
| Worker | API | HTTP Callback | Job status updates |
| Worker | Email Queue | Redis/BullMQ | Notification dispatch |

### 2.3 Event-Driven (Webhooks)

| Source | Target | Event | Use Case |
|--------|--------|-------|----------|
| Stripe | API | `checkout.session.completed` | Credit purchase |
| Stripe | API | `invoice.paid` | Subscription renewal |
| Supabase | Edge Function | `INSERT on auth.users` | New user setup |

### 2.4 Real-Time (Polling/WebSocket)

| From | To | Mechanism | Use Case |
|------|----|-----------|----------|
| Frontend | API | Polling (3s) | Job progress |
| Frontend | Supabase | Realtime | Live updates (future) |

---

## 3. Subsystem Communication Matrix

```
                    ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐
                    │Draft│Auth │Pipe │Scrpt│Voice│Align│Image│Rendr│Pckg │Bill │Email│
┌───────────────────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│ 01 Draft          │  -  │ W→  │     │     │     │     │     │     │     │     │     │
│ 02 Auth           │ ←R  │  -  │     │     │     │     │     │     │     │ W→  │ W→  │
│ 03 Pipeline       │     │ R→  │  -  │ W→  │ W→  │ W→  │ W→  │ W→  │ W→  │ W→  │ W→  │
│ 04 Script         │     │     │ ←R  │  -  │ W→  │     │ W→  │     │     │     │     │
│ 05 Voice          │     │     │ ←R  │ ←R  │  -  │ W→  │     │     │     │     │     │
│ 06 Alignment      │     │     │ ←R  │     │ ←R  │  -  │     │ W→  │     │     │     │
│ 07 Image          │     │     │ ←R  │ ←R  │     │     │  -  │ W→  │     │     │     │
│ 08 Render         │     │     │ ←R  │     │ ←R  │ ←R  │ ←R  │  -  │ W→  │     │     │
│ 09 Packaging      │     │     │ ←R  │     │     │     │     │ ←R  │  -  │     │     │
│ 10 Billing        │     │ ←R  │ ←R  │     │     │     │     │     │     │  -  │ W→  │
│ 11 Email          │     │ ←R  │ ←R  │     │     │     │     │     │     │ ←R  │  -  │
└───────────────────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘

Legend: R = Reads from, W = Writes to, → direction of data flow
```

---

## 4. Data Flow Sequences

### 4.1 User Signup with Draft Claim

```
┌──────┐     ┌────────┐     ┌─────┐     ┌────────┐     ┌─────────┐     ┌───────┐
│Client│     │Frontend│     │ API │     │Supabase│     │ Billing │     │ Email │
└──┬───┘     └───┬────┘     └──┬──┘     └───┬────┘     └────┬────┘     └───┬───┘
   │             │             │            │               │              │
   │ Enter prompt│             │            │               │              │
   │────────────►│             │            │               │              │
   │             │ POST /api/draft          │               │              │
   │             │────────────►│            │               │              │
   │             │             │ INSERT draft_prompts       │              │
   │             │             │───────────►│               │              │
   │             │             │◄───────────│               │              │
   │             │◄────────────│ {draftId}  │               │              │
   │◄────────────│             │            │               │              │
   │             │             │            │               │              │
   │ Click signup│             │            │               │              │
   │────────────►│             │            │               │              │
   │             │ Supabase Auth signUp     │               │              │
   │             │─────────────────────────►│               │              │
   │             │                          │ trigger: handle_new_user     │
   │             │                          │──────────────►│              │
   │             │                          │ INSERT profile│              │
   │             │                          │ INSERT credits (10 trial)    │
   │             │                          │◄──────────────│              │
   │             │◄─────────────────────────│ session       │              │
   │             │             │            │               │              │
   │             │ claim_draft_prompt       │               │              │
   │             │────────────►│───────────►│               │              │
   │             │             │            │               │              │
   │             │             │            │               │ Send welcome │
   │             │             │            │───────────────────────────────►
   │◄────────────│ Redirect /app/new?draft=xxx             │              │
```

### 4.2 Video Generation Pipeline

```
┌──────┐  ┌─────┐  ┌───────┐  ┌─────────┐  ┌────────┐  ┌──────────────────────────────┐
│Client│  │ API │  │ Redis │  │Supabase │  │ Worker │  │       External APIs          │
└──┬───┘  └──┬──┘  └───┬───┘  └────┬────┘  └───┬────┘  └──────────────┬───────────────┘
   │         │         │           │           │                      │
   │ POST /projects    │           │           │                      │
   │────────►│         │           │           │                      │
   │         │ Check credits       │           │                      │
   │         │─────────────────────►           │                      │
   │         │◄────────────────────│           │                      │
   │         │ Reserve credits     │           │                      │
   │         │─────────────────────►           │                      │
   │         │ INSERT project, job │           │                      │
   │         │─────────────────────►           │                      │
   │         │         │           │           │                      │
   │         │ Queue job           │           │                      │
   │         │─────────►           │           │                      │
   │◄────────│ {projectId, jobId}  │           │                      │
   │         │         │           │           │                      │
   │         │         │ Poll job  │           │                      │
   │         │         │──────────►│           │                      │
   │         │         │           │ Process job                      │
   │         │         │           │──────────►│                      │
   │         │         │           │           │                      │
   │         │         │           │           │ 1. SCRIPTING         │
   │         │         │           │◄──────────│ UPDATE job status    │
   │         │         │           │           │─────────────────────►│ OpenAI GPT
   │         │         │           │           │◄─────────────────────│ script
   │         │         │           │           │                      │
   │         │         │           │           │ 2. VOICE_GEN         │
   │         │         │           │◄──────────│ UPDATE job status    │
   │         │         │           │           │─────────────────────►│ OpenAI TTS
   │         │         │           │           │◄─────────────────────│ audio
   │         │         │           │           │                      │
   │         │         │           │           │ 3. ALIGNMENT         │
   │         │         │           │◄──────────│ UPDATE job status    │
   │         │         │           │           │─────────────────────►│ Whisper
   │         │         │           │           │◄─────────────────────│ timestamps
   │         │         │           │           │                      │
   │         │         │           │           │ 4. IMAGE_GEN         │
   │         │         │           │◄──────────│ UPDATE job status    │
   │         │         │           │           │─────────────────────►│ Gemini
   │         │         │           │           │◄─────────────────────│ images
   │         │         │           │           │                      │
   │         │         │           │           │ 5. RENDERING         │
   │         │         │           │◄──────────│ UPDATE job status    │
   │         │         │           │           │ Remotion render      │
   │         │         │           │           │                      │
   │         │         │           │           │ 6. PACKAGING         │
   │         │         │           │◄──────────│ UPDATE job status    │
   │         │         │           │           │ Upload to storage    │
   │         │         │           │◄──────────│                      │
   │         │         │           │           │                      │
   │         │         │           │           │ 7. COMPLETE          │
   │         │         │           │◄──────────│ Finalize credits     │
   │         │         │           │           │ Queue notification   │
   │         │         │──────────►│           │                      │
```

### 4.3 Credit Purchase Flow

```
┌──────┐     ┌─────┐     ┌────────┐     ┌────────┐     ┌─────────┐
│Client│     │ API │     │Supabase│     │ Stripe │     │ Billing │
└──┬───┘     └──┬──┘     └───┬────┘     └───┬────┘     └────┬────┘
   │            │            │              │               │
   │ Buy credits│            │              │               │
   │───────────►│            │              │               │
   │            │ Get/Create Stripe customer│               │
   │            │───────────►│              │               │
   │            │◄───────────│              │               │
   │            │            │              │               │
   │            │ Create checkout session   │               │
   │            │──────────────────────────►│               │
   │            │◄──────────────────────────│ checkout_url  │
   │◄───────────│            │              │               │
   │            │            │              │               │
   │ Redirect to Stripe      │              │               │
   │─────────────────────────────────────────►              │
   │            │            │              │               │
   │ Complete payment        │              │               │
   │◄────────────────────────────────────────               │
   │            │            │              │               │
   │            │ Webhook: checkout.session.completed       │
   │            │◄──────────────────────────│               │
   │            │            │              │               │
   │            │ Add credits│              │               │
   │            │───────────►│──────────────────────────────►
   │            │            │ INSERT credit_ledger         │
   │            │            │◄─────────────│               │
   │            │            │              │               │
   │ Redirect /app/credits?success=true    │               │
   │◄───────────│            │              │               │
```

---

## 5. Inter-Subsystem Contracts

### 5.1 Draft → Auth (Claim Draft)

**Trigger:** User completes signup/login  
**Mechanism:** Database function call

```typescript
// After successful auth
async function onAuthComplete(userId: string, sessionToken: string) {
  await supabase.rpc('claim_draft_prompt', {
    p_session_token: sessionToken,
    p_user_id: userId
  });
}
```

**Data Contract:**
```typescript
interface DraftClaim {
  sessionToken: string;  // From cookie
  userId: string;        // From auth.users
}
```

### 5.2 API → Pipeline (Job Dispatch)

**Trigger:** POST /api/v1/projects  
**Mechanism:** Redis BullMQ queue

```typescript
// API dispatches job
await jobQueue.add('generate-video', {
  jobId: string,
  projectId: string,
  userId: string,
  title: string,
  nichePreset: string,
  targetMinutes: number,
  content: string,
  voiceProfileId?: string
}, { jobId });
```

**Queue Contract:**
```typescript
interface VideoJobPayload {
  jobId: string;
  projectId: string;
  userId: string;
  title: string;
  nichePreset: 'motivation' | 'explainer' | 'facts' | 'history' | 'finance' | 'science';
  targetMinutes: number;
  content: string;
  voiceProfileId?: string;
}
```

### 5.3 Pipeline → Script (Generate Script)

**Trigger:** Pipeline step 1  
**Mechanism:** Function call within worker

```typescript
interface ScriptInput {
  prompt: string;
  nichePreset: string;
  targetMinutes: number;
  transcriptMode: 'auto' | 'manual';
  transcriptText?: string;
}

interface ScriptOutput {
  title: string;
  description: string;
  narrationText: string;
  scenes: Scene[];
  metadata: {
    estimatedDurationSec: number;
    wordCount: number;
    sceneCount: number;
  };
}
```

### 5.4 Script → Voice (Generate Audio)

**Trigger:** Pipeline step 2  
**Mechanism:** Function call, artifacts passed via context

```typescript
// Input from script step
const narrationText = ctx.artifacts.script.narrationText;

interface VoiceInput {
  text: string;
  voiceId: string;
  provider: 'openai' | 'elevenlabs';
  speed?: number;
}

interface VoiceOutput {
  audioPath: string;
  durationMs: number;
  format: 'mp3';
}
```

### 5.5 Voice → Alignment (Extract Timestamps)

**Trigger:** Pipeline step 3  
**Mechanism:** Function call

```typescript
interface AlignmentInput {
  audioPath: string;      // From voice step
  expectedText: string;   // From script step
}

interface AlignmentOutput {
  segments: WordSegment[];
  srtPath: string;
  vttPath: string;
}

interface WordSegment {
  word: string;
  start: number;  // seconds
  end: number;    // seconds
}
```

### 5.6 Script + Alignment → Image Gen

**Trigger:** Pipeline step 4-5  
**Mechanism:** Function call

```typescript
interface ImageGenInput {
  scenes: Array<{
    sceneId: string;
    imagePrompt: string;  // From script
    duration: number;     // From alignment
  }>;
  style: StyleConfig;
}

interface ImageGenOutput {
  images: Array<{
    sceneId: string;
    url: string;
    localPath: string;
  }>;
}
```

### 5.7 All Artifacts → Render

**Trigger:** Pipeline step 6-7  
**Mechanism:** Function call with full context

```typescript
interface RenderInput {
  audioPath: string;      // From voice
  imagePaths: string[];   // From image gen
  segments: WordSegment[]; // From alignment
  scenes: Scene[];        // From script
  captionStyle: CaptionStyle;
}

interface RenderOutput {
  videoPath: string;
  durationSec: number;
  fileSizeBytes: number;
}
```

### 5.8 Render → Packaging (Bundle Assets)

**Trigger:** Pipeline step 8  
**Mechanism:** Function call

```typescript
interface PackagingInput {
  videoPath: string;
  audioPath: string;
  srtPath: string;
  imagePaths: string[];
  scriptJson: object;
  timelineJson: object;
}

interface PackagingOutput {
  manifest: AssetManifest;
  zipUrl: string;
  assets: UploadedAsset[];
}
```

### 5.9 Pipeline → Billing (Credit Operations)

**Trigger:** Job start, complete, or fail  
**Mechanism:** Supabase RPC

```typescript
// On job start
await supabase.rpc('reserve_credits', {
  p_user_id: userId,
  p_job_id: jobId,
  p_amount: estimatedCredits
});

// On job complete
await supabase.rpc('finalize_job_credits', {
  p_user_id: userId,
  p_job_id: jobId,
  p_final_cost: actualCredits
});

// On job fail
await supabase.rpc('release_job_credits', {
  p_job_id: jobId
});
```

### 5.10 Pipeline → Email (Notifications)

**Trigger:** Job complete or fail  
**Mechanism:** Redis queue or direct call

```typescript
interface NotificationPayload {
  userId: string;
  type: 'job_complete' | 'job_failed' | 'low_credits';
  data: {
    jobId?: string;
    projectTitle?: string;
    downloadUrl?: string;
    errorMessage?: string;
  };
}

// Queue notification
await emailQueue.add('send', {
  to: user.email,
  template: payload.type,
  data: payload.data
});
```

---

## 6. Shared Data Stores

### 6.1 PostgreSQL (Supabase)

| Table | Primary Writer | Readers |
|-------|---------------|---------|
| `draft_prompts` | Draft API | Auth, Project API |
| `profiles` | Auth trigger | All |
| `projects` | Project API | Pipeline, Frontend |
| `jobs` | Pipeline | Frontend, Billing |
| `job_steps` | Pipeline | Frontend |
| `assets` | Packaging | Frontend |
| `credit_ledger` | Billing | Frontend, Pipeline |
| `subscriptions` | Stripe webhook | Frontend, Billing |

### 6.2 Redis

| Key Pattern | Writer | Reader | TTL |
|-------------|--------|--------|-----|
| `bull:video-generation:*` | API | Worker | Job lifetime |
| `bull:emails:*` | Pipeline | Email worker | Job lifetime |
| `rate:ip:{ip}` | API | API | 1 hour |
| `cache:script:{hash}` | Script | Script | 24 hours |

### 6.3 Object Storage (Supabase Storage)

| Bucket | Writer | Reader |
|--------|--------|--------|
| `generated-assets` | Packaging | Frontend (CDN) |
| `voice-samples` | Voice Profile API | Voice step |
| `temp-processing` | Pipeline steps | Pipeline steps |

---

## 7. Error Propagation

### 7.1 Pipeline Error Handling

```typescript
async function runPipeline(job: JobRow): Promise<void> {
  try {
    for (const step of PIPELINE_STEPS) {
      await updateStatus(job.id, step.name, 'started');
      
      const result = await step.execute(ctx);
      
      if (!result.success) {
        throw new PipelineError(step.name, result.error);
      }
      
      await updateStatus(job.id, step.name, 'succeeded');
    }
    
    await onJobComplete(job);
    
  } catch (error) {
    await onJobFailed(job, error);
  }
}

async function onJobFailed(job: JobRow, error: Error): Promise<void> {
  // 1. Update job status
  await supabase.from('jobs').update({
    status: 'FAILED',
    error_code: error.code,
    error_message: error.message,
    failed_step: error.step
  }).eq('id', job.id);
  
  // 2. Release credits (Billing subsystem)
  await supabase.rpc('release_job_credits', { p_job_id: job.id });
  
  // 3. Notify user (Email subsystem)
  await queueNotification({
    userId: job.user_id,
    type: 'job_failed',
    data: { jobId: job.id, errorMessage: error.message }
  });
}
```

### 7.2 Webhook Error Handling

```typescript
// Stripe webhook with idempotency
app.post('/api/webhooks/stripe', async (req, res) => {
  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      STRIPE_WEBHOOK_SECRET
    );
    
    // Check idempotency
    const processed = await redis.get(`stripe:event:${event.id}`);
    if (processed) {
      return res.json({ received: true, duplicate: true });
    }
    
    await processStripeEvent(event);
    
    // Mark as processed
    await redis.set(`stripe:event:${event.id}`, '1', 'EX', 86400);
    
    res.json({ received: true });
    
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: error.message });
  }
});
```

---

## 8. Configuration & Environment

### 8.1 Shared Environment Variables

```bash
# All services need these
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
REDIS_URL=redis://...

# API-specific
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
INTERNAL_API_KEY=xxx

# Worker-specific
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=...
GEMINI_API_KEY=...

# Frontend-specific
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_URL=https://api.canvascast.ai
```

### 8.2 Service Discovery

| Service | Internal URL | External URL |
|---------|-------------|--------------|
| Web | `http://web:3000` | `https://canvascast.ai` |
| API | `http://api:8989` | `https://api.canvascast.ai` |
| Worker | `http://worker:9000` | N/A (internal only) |
| Redis | `redis://redis:6379` | N/A |
| Supabase | `https://xxx.supabase.co` | Same |

---

## 9. Monitoring & Observability

### 9.1 Cross-System Tracing

```typescript
// Add trace ID to all requests
interface TraceContext {
  traceId: string;    // Unique per user request
  spanId: string;     // Unique per operation
  parentSpanId?: string;
}

// Pass through pipeline
const ctx: PipelineContext = {
  ...baseContext,
  trace: {
    traceId: job.id,  // Use job ID as trace
    spanId: generateSpanId(),
  }
};

// Log with trace
console.log(JSON.stringify({
  traceId: ctx.trace.traceId,
  spanId: ctx.trace.spanId,
  step: 'SCRIPTING',
  event: 'started',
  timestamp: Date.now()
}));
```

### 9.2 Health Checks

```typescript
// Each service exposes health
GET /health → { status: 'ok', uptime: ms }

// Ready check validates dependencies
GET /ready → {
  ready: boolean,
  checks: {
    database: boolean,
    redis: boolean,
    storage: boolean
  }
}
```

---

## 10. Files Reference

| Subsystem | Integration Code |
|-----------|------------------|
| Draft | `apps/web/src/app/api/draft/route.ts` |
| Auth | `apps/web/src/app/auth/callback/route.ts` |
| Pipeline | `apps/worker/src/pipeline/runner.ts` |
| Script | `apps/worker/src/pipeline/steps/generate-script.ts` |
| Voice | `apps/worker/src/pipeline/steps/generate-voice.ts` |
| Alignment | `apps/worker/src/pipeline/steps/run-alignment.ts` |
| Image | `apps/worker/src/pipeline/steps/generate-images.ts` |
| Render | `apps/worker/src/pipeline/steps/render-video.ts` |
| Packaging | `apps/worker/src/pipeline/steps/package-assets.ts` |
| Billing | `apps/api/src/index.ts` (credit endpoints) |
| Email | `apps/worker/src/notify.ts` |
