# PRD: Cloud Compute (Modal)

**Subsystem:** Compute  
**Version:** 1.0  
**Status:** Implemented  
**Owner:** Isaiah  

---

## 1. Overview

The Cloud Compute subsystem uses Modal for GPU-accelerated workloads like image generation and video rendering. It provides serverless, auto-scaling compute that spins up on demand and scales to zero when idle.

### Business Goal
Run compute-intensive tasks cost-effectively with fast cold starts and automatic scaling.

---

## 2. User Stories

### US-1: Fast Processing
**As a** user  
**I want** videos to render quickly  
**So that** I don't wait too long

### US-2: Reliable Scaling
**As a** system  
**I need** auto-scaling compute  
**So that** I can handle traffic spikes

### US-3: Cost Efficiency
**As a** business  
**I want** pay-per-use compute  
**So that** I don't pay for idle resources

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         COMPUTE ARCHITECTURE                             │
│                                                                         │
│  ┌─────────────┐                      ┌──────────────────────────────┐ │
│  │   Worker    │──── HTTP Request ───►│           Modal              │ │
│  │  (Railway)  │                      │                              │ │
│  └─────────────┘                      │  ┌────────────────────────┐  │ │
│         │                             │  │      GPU Functions     │  │ │
│         │                             │  │                        │  │ │
│         │                             │  │  ┌──────────────────┐  │  │ │
│         │                             │  │  │  Image Gen       │  │  │ │
│         │                             │  │  │  (A10G GPU)      │  │  │ │
│         │                             │  │  └──────────────────┘  │  │ │
│         │                             │  │                        │  │ │
│         │                             │  │  ┌──────────────────┐  │  │ │
│         │                             │  │  │  Video Render    │  │  │ │
│         │                             │  │  │  (CPU + GPU)     │  │  │ │
│         │                             │  │  └──────────────────┘  │  │ │
│         │                             │  │                        │  │ │
│         │                             │  │  ┌──────────────────┐  │  │ │
│         │                             │  │  │  Whisper         │  │  │ │
│         │                             │  │  │  (A10G GPU)      │  │  │ │
│         │                             │  │  └──────────────────┘  │  │ │
│         │                             │  └────────────────────────┘  │ │
│         │                             │                              │ │
│         │◄───── Results + Files ──────│  ┌────────────────────────┐  │ │
│         │                             │  │    Volume Storage      │  │ │
│         │                             │  │    (temp files)        │  │ │
│         │                             │  └────────────────────────┘  │ │
│         │                             └──────────────────────────────┘ │
└─────────┼───────────────────────────────────────────────────────────────┘
          │
          ▼
   ┌───────────┐
   │  Supabase │
   │  Storage  │
   └───────────┘
```

---

## 4. Modal Functions

### Image Generation Function
```python
# modal_functions/image_gen.py
import modal

stub = modal.Stub("canvascast-image-gen")

image = modal.Image.debian_slim().pip_install(
    "google-generativeai",
    "pillow",
    "httpx"
)

@stub.function(
    image=image,
    gpu="A10G",
    timeout=300,
    retries=2,
    concurrency_limit=10,
)
def generate_images(prompts: list[str], style: dict) -> list[bytes]:
    """Generate images using Gemini Imagen."""
    import google.generativeai as genai
    
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    
    results = []
    for prompt in prompts:
        response = genai.generate_images(
            model="imagen-3.0-generate-001",
            prompt=prompt,
            number_of_images=1,
        )
        results.append(response.images[0].image_bytes)
    
    return results
```

### Video Render Function
```python
# modal_functions/render.py
import modal

stub = modal.Stub("canvascast-render")

image = (
    modal.Image.debian_slim()
    .apt_install("chromium", "ffmpeg", "fonts-liberation")
    .pip_install("remotion-python")
    .run_commands("npm install -g @remotion/cli")
)

volume = modal.Volume.from_name("canvascast-render-cache", create_if_missing=True)

@stub.function(
    image=image,
    cpu=4,
    memory=8192,
    timeout=600,
    volumes={"/cache": volume},
)
def render_video(timeline: dict, output_format: str = "mp4") -> bytes:
    """Render video using Remotion."""
    import subprocess
    import json
    
    # Write timeline
    with open("/tmp/timeline.json", "w") as f:
        json.dump(timeline, f)
    
    # Run Remotion render
    subprocess.run([
        "npx", "remotion", "render",
        "--props", "/tmp/timeline.json",
        "--output", "/tmp/output.mp4",
        "--codec", "h264",
    ], check=True)
    
    with open("/tmp/output.mp4", "rb") as f:
        return f.read()
```

### Whisper Alignment Function
```python
# modal_functions/whisper.py
import modal

stub = modal.Stub("canvascast-whisper")

image = modal.Image.debian_slim().pip_install(
    "openai-whisper",
    "torch",
    "torchaudio",
)

@stub.function(
    image=image,
    gpu="A10G",
    timeout=300,
)
def transcribe_audio(audio_bytes: bytes) -> dict:
    """Transcribe audio with word-level timestamps."""
    import whisper
    import tempfile
    
    model = whisper.load_model("base")
    
    with tempfile.NamedTemporaryFile(suffix=".mp3") as f:
        f.write(audio_bytes)
        f.flush()
        
        result = model.transcribe(
            f.name,
            word_timestamps=True,
            language="en",
        )
    
    return {
        "segments": result["segments"],
        "words": [
            {"word": w["word"], "start": w["start"], "end": w["end"]}
            for seg in result["segments"]
            for w in seg.get("words", [])
        ],
    }
```

---

## 5. Modal Client (Worker)

### Client Implementation
```typescript
// apps/worker/src/modal-client.ts

const MODAL_ENDPOINT = process.env.MODAL_ENDPOINT;
const MODAL_TOKEN = process.env.MODAL_TOKEN;

interface ModalResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function callModalFunction<T>(
  functionName: string,
  payload: object,
  options: { timeout?: number } = {}
): Promise<T> {
  const response = await fetch(`${MODAL_ENDPOINT}/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MODAL_TOKEN}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(options.timeout || 300000),
  });
  
  if (!response.ok) {
    throw new ModalError(`Modal function failed: ${response.statusText}`);
  }
  
  const result: ModalResponse<T> = await response.json();
  
  if (!result.success) {
    throw new ModalError(result.error || 'Unknown error');
  }
  
  return result.data!;
}

// Typed function callers
export async function generateImagesModal(
  prompts: string[],
  style: StyleConfig
): Promise<Buffer[]> {
  return callModalFunction('generate_images', { prompts, style });
}

export async function renderVideoModal(
  timeline: TimelineData
): Promise<Buffer> {
  return callModalFunction('render_video', { timeline }, { timeout: 600000 });
}

export async function transcribeAudioModal(
  audioBuffer: Buffer
): Promise<WhisperResult> {
  return callModalFunction('transcribe_audio', { 
    audio_bytes: audioBuffer.toString('base64') 
  });
}
```

---

## 6. Fallback Strategy

### Local Fallback
```typescript
// If Modal is unavailable, fall back to local processing
async function generateImages(
  prompts: string[],
  style: StyleConfig
): Promise<Buffer[]> {
  try {
    // Try Modal first
    return await generateImagesModal(prompts, style);
  } catch (error) {
    if (error.code === 'MODAL_UNAVAILABLE') {
      console.log('[COMPUTE] Modal unavailable, using local fallback');
      return await generateImagesLocal(prompts, style);
    }
    throw error;
  }
}
```

### Circuit Breaker
```typescript
class ModalCircuitBreaker {
  private failures = 0;
  private lastFailure?: Date;
  private readonly threshold = 5;
  private readonly resetTimeout = 60000; // 1 minute
  
  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error('Circuit breaker is open');
    }
    
    try {
      const result = await fn();
      this.reset();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
  
  private isOpen(): boolean {
    if (this.failures < this.threshold) return false;
    if (!this.lastFailure) return false;
    
    const elapsed = Date.now() - this.lastFailure.getTime();
    return elapsed < this.resetTimeout;
  }
  
  private recordFailure(): void {
    this.failures++;
    this.lastFailure = new Date();
  }
  
  private reset(): void {
    this.failures = 0;
    this.lastFailure = undefined;
  }
}
```

---

## 7. Scaling Configuration

### Modal Settings
```python
# modal.toml
[app]
name = "canvascast"

[functions.generate_images]
gpu = "A10G"
min_containers = 0
max_containers = 10
scaledown_delay = 60  # seconds

[functions.render_video]
cpu = 4
memory = 8192
min_containers = 0
max_containers = 5
scaledown_delay = 120

[functions.transcribe_audio]
gpu = "A10G"
min_containers = 0
max_containers = 10
scaledown_delay = 60
```

### Cost Optimization
```typescript
const COMPUTE_CONFIG = {
  // Batch similar requests to reduce cold starts
  batchSize: {
    images: 5,      // Generate 5 images per invocation
    whisper: 1,     // One audio file per invocation
  },
  
  // Timeouts
  timeout: {
    images: 300,    // 5 minutes
    render: 600,    // 10 minutes
    whisper: 180,   // 3 minutes
  },
  
  // Retry settings
  retries: {
    images: 2,
    render: 1,
    whisper: 2,
  },
};
```

---

## 8. Warm Pools (Optional)

Keep containers warm for faster cold starts:

```python
@stub.function(
    schedule=modal.Cron("*/5 * * * *"),  # Every 5 minutes
)
def keep_warm():
    """Keep one container warm during peak hours."""
    import datetime
    
    hour = datetime.datetime.now().hour
    
    # Only during business hours (9 AM - 9 PM)
    if 9 <= hour <= 21:
        # Trigger a minimal invocation
        generate_images.remote(["warmup"], {"style": "minimal"})
```

---

## 9. Error Handling

| Error | Cause | Recovery |
|-------|-------|----------|
| Cold start timeout | First invocation slow | Increase timeout |
| GPU OOM | Model too large | Use smaller batch |
| Container crash | Bug or resource issue | Retry with backoff |
| Rate limited | Too many requests | Queue and throttle |

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (!isRetryable(error)) throw error;
      
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
      await sleep(delay);
    }
  }
  
  throw lastError;
}

function isRetryable(error: Error): boolean {
  return [
    'TIMEOUT',
    'CONTAINER_CRASH',
    'RATE_LIMITED',
  ].includes(error.code);
}
```

---

## 10. Metrics

| Metric | Description |
|--------|-------------|
| `modal_invocations` | Function calls |
| `modal_duration_ms` | Execution time |
| `modal_cold_starts` | Cold start count |
| `modal_errors` | Failed invocations |
| `modal_cost_usd` | Compute cost |

---

## 11. System Integration

### Communicates With

| Subsystem | Direction | Mechanism | Purpose |
|-----------|-----------|-----------|---------|
| **Pipeline** | Pipeline → Modal | HTTP API | Dispatch compute tasks |
| **Image Gen** | Worker → Modal | Function call | GPU image generation |
| **Render** | Worker → Modal | Function call | Video rendering |
| **Alignment** | Worker → Modal | Function call | Whisper transcription |
| **Storage** | Modal → Storage | Supabase client | Upload results |

### Data Flow
```
┌─────────────────────────────────────────────────────────────────┐
│                      COMPUTE SUBSYSTEM                           │
│                                                                 │
│  ┌──────────────┐                      ┌──────────────────┐    │
│  │   Pipeline   │──── HTTP Request ───►│      Modal       │    │
│  │   Runner     │                      │                  │    │
│  └──────────────┘                      │  ┌────────────┐  │    │
│         │                              │  │ GPU/CPU    │  │    │
│         │                              │  │ Functions  │  │    │
│         │                              │  └─────┬──────┘  │    │
│         │                              │        │         │    │
│         │                              │        ▼         │    │
│         │◄───── Results ───────────────│  ┌────────────┐  │    │
│         │                              │  │  Process   │  │    │
│         │                              │  │   Data     │  │    │
│         │                              │  └────────────┘  │    │
│         │                              └──────────────────┘    │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐                                              │
│  │   Storage    │◄─────────────────────────────────────────────│
│  │   (assets)   │                                              │
│  └──────────────┘                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. Files

| File | Purpose |
|------|---------|
| `apps/worker/src/modal-client.ts` | Modal HTTP client |
| `modal_functions/image_gen.py` | Image generation function |
| `modal_functions/render.py` | Video render function |
| `modal_functions/whisper.py` | Audio transcription |
| `modal.toml` | Modal configuration |
