# PRD: Job Queue & Pipeline Orchestration

**Subsystem:** Pipeline  
**Version:** 1.0  
**Status:** Implemented  
**Owner:** Isaiah  

---

## 1. Overview

The Pipeline Orchestrator manages video generation jobs through a multi-step workflow. It uses BullMQ for job queuing and Redis for state management, ensuring reliable execution with retry logic and progress tracking.

### Business Goal
Process video generation reliably at scale with detailed progress visibility and automatic failure recovery.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         API Server                            │
│  POST /api/v1/projects → Create Job → Queue to Redis         │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                      Redis (BullMQ)                           │
│  Queue: "video-generation"                                    │
│  - Pending jobs                                               │
│  - Active jobs                                                │
│  - Completed/Failed jobs                                      │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                      Worker Process                           │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                   Pipeline Runner                        │ │
│  │  1. SCRIPTING     → Generate script from prompt         │ │
│  │  2. VOICE_GEN     → Create narration audio (TTS)        │ │
│  │  3. ALIGNMENT     → Extract word timestamps (Whisper)   │ │
│  │  4. VISUAL_PLAN   → Plan scene layout                   │ │
│  │  5. IMAGE_GEN     → Generate images (Gemini)            │ │
│  │  6. TIMELINE_BUILD → Create Remotion timeline           │ │
│  │  7. RENDERING     → Render video (Remotion)             │ │
│  │  8. PACKAGING     → Bundle assets + upload              │ │
│  │  9. READY         → Notify user                         │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Job States

```typescript
type JobStatus =
  | 'QUEUED'
  | 'SCRIPTING'
  | 'VOICE_GEN'
  | 'ALIGNMENT'
  | 'VISUAL_PLAN'
  | 'IMAGE_GEN'
  | 'TIMELINE_BUILD'
  | 'RENDERING'
  | 'PACKAGING'
  | 'READY'
  | 'FAILED';
```

### State Transitions

```
QUEUED → SCRIPTING → VOICE_GEN → ALIGNMENT → VISUAL_PLAN 
       → IMAGE_GEN → TIMELINE_BUILD → RENDERING → PACKAGING → READY

Any state can transition to FAILED
```

---

## 4. Functional Requirements

### FR-1: Job Creation

**Trigger:** `POST /api/v1/projects`

**Process:**
1. Validate user has credits
2. Reserve credits
3. Create project record
4. Create job record (status: QUEUED)
5. Add job to BullMQ queue
6. Return job ID

**BullMQ Job Data:**
```typescript
{
  jobId: string;
  projectId: string;
  userId: string;
  title: string;
  nichePreset: string;
  targetMinutes: number;
  content: string;
  voiceProfileId?: string;
}
```

### FR-2: Job Processing

**Worker Entry:**
```typescript
async function processJob(job: Job) {
  const { jobId } = job.data;
  await runPipeline(jobId);
}
```

**Pipeline Steps:**
```typescript
async function runPipeline(job: JobRow): Promise<void> {
  const ctx = buildContext(job);
  
  await step('SCRIPTING', () => generateScript(ctx));
  await step('VOICE_GEN', () => generateVoice(ctx));
  await step('ALIGNMENT', () => runAlignment(ctx));
  await step('VISUAL_PLAN', () => planVisuals(ctx));
  await step('IMAGE_GEN', () => generateImages(ctx));
  await step('TIMELINE_BUILD', () => buildTimeline(ctx));
  await step('RENDERING', () => renderVideo(ctx));
  await step('PACKAGING', () => packageAssets(ctx));
  
  await completeJob(job.id, ctx);
}
```

### FR-3: Progress Tracking

Each step updates:
- `jobs.status` - Current step name
- `jobs.progress` - 0-100 percentage
- `jobs.updated_at` - Timestamp
- `job_steps` - Per-step status

**Progress Percentages:**
| Step | Start % | End % |
|------|---------|-------|
| SCRIPTING | 5 | 15 |
| VOICE_GEN | 15 | 25 |
| ALIGNMENT | 25 | 40 |
| VISUAL_PLAN | 40 | 50 |
| IMAGE_GEN | 50 | 70 |
| TIMELINE_BUILD | 70 | 75 |
| RENDERING | 75 | 95 |
| PACKAGING | 95 | 100 |

### FR-4: Error Handling

```typescript
async function step(name: string, fn: () => Promise<Result>) {
  try {
    await updateJobStatus(jobId, name, progressStart);
    const result = await fn();
    if (!result.success) {
      throw new PipelineError(result.error);
    }
    return result.data;
  } catch (error) {
    await failJob(jobId, name, error);
    throw error;
  }
}
```

**On Failure:**
1. Update job status to FAILED
2. Record failed_step and error_json
3. Release reserved credits
4. Log error details
5. Optionally notify user

### FR-5: Retry Logic

**BullMQ Configuration:**
```typescript
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000 // 5s, 10s, 20s
  },
  removeOnComplete: 100,
  removeOnFail: 50
}
```

**Non-Retryable Errors:**
- Invalid input
- Credit insufficient
- User cancelled

**Retryable Errors:**
- API timeout
- Rate limiting
- Temporary service outage

---

## 5. Data Model

### Table: `jobs`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `project_id` | UUID | FK → projects |
| `user_id` | UUID | FK → auth.users |
| `status` | job_status | Current state |
| `progress` | INT | 0-100 |
| `status_message` | TEXT | Human-readable |
| `cost_credits_reserved` | INT | Credits held |
| `cost_credits_final` | INT | Actual cost |
| `failed_step` | TEXT | Step that failed |
| `error_code` | TEXT | Error code |
| `error_message` | TEXT | Error details |
| `created_at` | TIMESTAMPTZ | Creation time |
| `started_at` | TIMESTAMPTZ | Processing start |
| `finished_at` | TIMESTAMPTZ | Completion time |

### Table: `job_steps`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `job_id` | UUID | FK → jobs |
| `step_name` | TEXT | Step identifier |
| `step_order` | INT | Sequence number |
| `state` | step_status | pending/started/succeeded/failed |
| `progress_pct` | INT | Step progress |
| `status_message` | TEXT | Step message |
| `error_message` | TEXT | Error if failed |
| `logs_url` | TEXT | Link to detailed logs |
| `artifacts_json` | JSONB | Partial outputs |
| `started_at` | TIMESTAMPTZ | Step start |
| `finished_at` | TIMESTAMPTZ | Step end |

---

## 6. Pipeline Context

```typescript
interface PipelineContext {
  job: JobRow;
  project: ProjectRow;
  userId: string;
  projectId: string;
  jobId: string;
  basePath: string;      // Storage path base
  outputPath: string;    // Final output path
  artifacts: {
    mergedInputText?: string;
    script?: ScriptData;
    narrationPath?: string;
    narrationDurationMs?: number;
    whisperSegments?: Segment[];
    captionsSrtPath?: string;
    visualPlan?: VisualPlan;
    imagePaths?: string[];
    timeline?: TimelineData;
    timelinePath?: string;
    videoPath?: string;
    zipPath?: string;
  };
}
```

---

## 7. Concurrency

### Worker Configuration
```typescript
const worker = new Worker('video-generation', processJob, {
  connection: redis,
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2'),
  limiter: {
    max: 5,
    duration: 60000 // 5 jobs per minute
  }
});
```

### Resource Limits
- Max concurrent jobs per worker: 2
- Max jobs per user in queue: 5
- Job timeout: 30 minutes

---

## 8. Monitoring

### Health Checks
```typescript
GET /health → { status: 'ok', uptime: ms }
GET /ready → { ready: boolean, checks: { redis, supabase } }
```

### Queue Metrics
- Jobs waiting
- Jobs active
- Jobs completed (last hour)
- Jobs failed (last hour)
- Average processing time

### Alerts
- Queue depth > 100
- Job failure rate > 10%
- Average processing time > 15 min

---

## 9. Files

| File | Purpose |
|------|---------|
| `apps/worker/src/index.ts` | Worker entry point |
| `apps/worker/src/worker.ts` | BullMQ worker setup |
| `apps/worker/src/pipeline/runner.ts` | Pipeline orchestrator |
| `apps/worker/src/pipeline/types.ts` | Context & types |
| `apps/worker/src/pipeline/steps/` | Individual step implementations |
| `apps/api/src/index.ts` | Job queue producer |

---

## 10. System Integration

### Communicates With

| Subsystem | Direction | Mechanism | Purpose |
|-----------|-----------|-----------|---------|
| **API** | API → Pipeline | Redis/BullMQ | Job dispatch |
| **Script** | Pipeline → Script | Function call | Generate script |
| **Voice** | Pipeline → Voice | Function call | Generate narration |
| **Alignment** | Pipeline → Alignment | Function call | Extract timestamps |
| **Image** | Pipeline → Image | Function call | Generate visuals |
| **Render** | Pipeline → Render | Function call | Compose video |
| **Packaging** | Pipeline → Packaging | Function call | Bundle assets |
| **Billing** | Pipeline → Billing | Supabase RPC | Credit operations |
| **Email** | Pipeline → Email | Redis queue | Notifications |
| **Database** | Pipeline ↔ DB | Supabase client | Status updates |

### Inbound Interfaces

```typescript
// From API: Job dispatch via BullMQ
interface VideoJobPayload {
  jobId: string;
  projectId: string;
  userId: string;
  title: string;
  nichePreset: string;
  targetMinutes: number;
  content: string;
  voiceProfileId?: string;
}

// Worker receives from queue
worker.on('active', async (job) => {
  await runPipeline(job.data);
});
```

### Outbound Interfaces

```typescript
// To each pipeline step (internal)
interface StepResult<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

// To Billing: Credit operations
await supabase.rpc('reserve_credits', { p_user_id, p_job_id, p_amount });
await supabase.rpc('finalize_job_credits', { p_user_id, p_job_id, p_final_cost });
await supabase.rpc('release_job_credits', { p_job_id });

// To Email: Notifications
await emailQueue.add('send', { to, template, data });

// To Database: Status updates
await supabase.from('jobs').update({ status, progress }).eq('id', jobId);
await supabase.from('job_steps').update({ state, progress_pct }).eq('job_id', jobId);
```

### Pipeline Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PIPELINE ORCHESTRATOR                              │
│                                                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │ Script  │───►│  Voice  │───►│ Whisper │───►│  Image  │───►│ Render  │  │
│  │   LLM   │    │   TTS   │    │  Align  │    │   Gen   │    │Remotion │  │
│  └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘  │
│       │              │              │              │              │        │
│       ▼              ▼              ▼              ▼              ▼        │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                      PIPELINE CONTEXT (ctx.artifacts)                │  │
│  │  script ──► narrationPath ──► segments ──► imagePaths ──► videoPath │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                     │                                      │
└─────────────────────────────────────┼──────────────────────────────────────┘
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                       ▼                       ▼
       ┌───────────┐           ┌───────────┐           ┌───────────┐
       │  Billing  │           │  Database │           │   Email   │
       │  Credits  │           │  Status   │           │  Notify   │
       └───────────┘           └───────────┘           └───────────┘
```

### Step Communication Pattern

Each step receives context and returns results:

```typescript
// Step signature
type PipelineStep = (ctx: PipelineContext) => Promise<StepResult<StepOutput>>;

// Runner orchestrates
for (const step of steps) {
  await updateStatus(ctx.jobId, step.name, 'started');
  
  const result = await step.execute(ctx);
  
  if (!result.success) {
    await handleFailure(ctx, step.name, result.error);
    return;
  }
  
  // Merge artifacts for next step
  ctx.artifacts = { ...ctx.artifacts, ...result.data };
  
  await updateStatus(ctx.jobId, step.name, 'succeeded');
}
```
