# PRD: Voice Generation (TTS)

**Subsystem:** Voice/TTS  
**Version:** 1.0  
**Status:** Implemented  
**Owner:** Isaiah  

---

## 1. Overview

The Voice Generation subsystem converts narration text to spoken audio using Text-to-Speech (TTS) services. It supports multiple providers (OpenAI, ElevenLabs, Hugging Face) and will eventually support custom voice cloning.

### Business Goal
Produce professional-quality narration that sounds natural and engaging, with options for customization.

---

## 2. User Stories

### US-1: Default Voice
**As a** user  
**I want** AI-generated narration  
**So that** I don't need to record my own voice

### US-2: Voice Selection
**As a** user  
**I want to** choose from different voices  
**So that** I can match the tone to my content

### US-3: Custom Voice (V1)
**As a** user  
**I want to** upload my voice samples  
**So that** the narration sounds like me

---

## 3. Supported Providers

| Provider | Voices | Quality | Latency | Cost |
|----------|--------|---------|---------|------|
| OpenAI TTS | 6 | High | Low | $15/1M chars |
| ElevenLabs | 100+ | Very High | Medium | $0.30/1K chars |
| Hugging Face | Open | Medium | High | Free/Self-hosted |

### Default Provider: OpenAI TTS

**Voices:**
- `alloy` - Neutral, balanced (default)
- `echo` - Warm, conversational
- `fable` - Expressive, dynamic
- `onyx` - Deep, authoritative
- `nova` - Friendly, upbeat
- `shimmer` - Soft, gentle

---

## 4. Input/Output

### Input
```typescript
interface VoiceInput {
  text: string;              // Narration text
  voiceId: string;           // Voice identifier
  provider: 'openai' | 'elevenlabs' | 'huggingface';
  speed?: number;            // 0.5 - 2.0 (default 1.0)
  outputFormat?: 'mp3' | 'wav';
}
```

### Output
```typescript
interface VoiceOutput {
  audioPath: string;         // Storage path to audio file
  durationMs: number;        // Audio duration
  format: 'mp3' | 'wav';
  sampleRate: number;        // e.g., 44100
  provider: string;
  voiceId: string;
}
```

---

## 5. Functional Requirements

### FR-1: Generate Narration Audio

**Process:**
1. Receive narration text from script
2. Select provider and voice
3. Call TTS API
4. Stream response to temp file
5. Upload to storage
6. Return path and metadata

### FR-2: OpenAI TTS Integration

```typescript
async function generateWithOpenAI(input: VoiceInput): Promise<Buffer> {
  const response = await openai.audio.speech.create({
    model: 'tts-1-hd',
    voice: input.voiceId as any,
    input: input.text,
    speed: input.speed || 1.0,
    response_format: input.outputFormat || 'mp3',
  });
  
  return Buffer.from(await response.arrayBuffer());
}
```

### FR-3: ElevenLabs Integration

```typescript
async function generateWithElevenLabs(input: VoiceInput): Promise<Buffer> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${input.voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: input.text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    }
  );
  
  return Buffer.from(await response.arrayBuffer());
}
```

### FR-4: Duration Detection

```typescript
async function getAudioDuration(audioPath: string): Promise<number> {
  const { stdout } = await exec(
    `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${audioPath}"`
  );
  return Math.round(parseFloat(stdout) * 1000); // ms
}
```

### FR-5: Text Preprocessing

Before TTS:
- Remove markdown formatting
- Convert abbreviations to spoken form
- Add natural pauses (... → 1 sec pause)
- Handle numbers (1000 → "one thousand")

```typescript
function preprocessText(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold
    .replace(/\n{2,}/g, '... ')        // Paragraph breaks
    .replace(/(\d),(\d)/g, '$1$2')     // Remove number commas
    .replace(/\$/g, ' dollars ')       // Currency
    .trim();
}
```

---

## 6. Voice Profiles (V1 Feature)

### Upload Flow
1. User uploads 3-5 voice samples (30s-3min each)
2. Samples stored in `voice-samples` bucket
3. Profile created with status `pending`
4. Background job processes samples
5. Status updated to `ready` or `failed`

### Table: `voice_profiles`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → auth.users |
| `name` | TEXT | Display name |
| `status` | TEXT | pending/processing/ready/failed |
| `samples_path` | TEXT | Storage paths (comma-sep) |
| `provider` | TEXT | e.g., 'elevenlabs' |
| `external_voice_id` | TEXT | Provider's voice ID |
| `created_at` | TIMESTAMPTZ | Creation time |

### Voice Cloning (ElevenLabs)
```typescript
async function createClonedVoice(profile: VoiceProfile): Promise<string> {
  const formData = new FormData();
  formData.append('name', profile.name);
  
  for (const samplePath of profile.samples_path.split(',')) {
    const sample = await downloadSample(samplePath);
    formData.append('files', sample);
  }
  
  const response = await fetch(
    'https://api.elevenlabs.io/v1/voices/add',
    {
      method: 'POST',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY },
      body: formData,
    }
  );
  
  const { voice_id } = await response.json();
  return voice_id;
}
```

---

## 7. Error Handling

| Error | Cause | Recovery |
|-------|-------|----------|
| Rate limited | API quota exceeded | Backoff and retry |
| Text too long | >4096 chars | Split into chunks |
| Invalid voice | Voice not found | Fall back to default |
| Audio corrupted | Generation failed | Retry with different params |

### Chunking Long Text
```typescript
function chunkText(text: string, maxChars = 4000): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let current = '';
  
  for (const sentence of sentences) {
    if ((current + sentence).length > maxChars) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  
  if (current) chunks.push(current.trim());
  return chunks;
}
```

---

## 8. Audio Processing

### Normalization
```bash
ffmpeg -i input.mp3 -af "loudnorm=I=-16:TP=-1.5:LRA=11" output.mp3
```

### Format Conversion
```typescript
async function convertToWav(mp3Path: string): Promise<string> {
  const wavPath = mp3Path.replace('.mp3', '.wav');
  await exec(`ffmpeg -i "${mp3Path}" -ar 16000 -ac 1 "${wavPath}"`);
  return wavPath;
}
```

---

## 9. Configuration

```typescript
const VOICE_CONFIG = {
  defaultProvider: 'openai',
  defaultVoice: 'alloy',
  defaultSpeed: 1.0,
  outputFormat: 'mp3',
  
  maxTextLength: 10000,
  chunkSize: 4000,
  
  openai: {
    model: 'tts-1-hd',
    timeout: 60000,
  },
  
  elevenlabs: {
    model: 'eleven_multilingual_v2',
    stability: 0.5,
    similarityBoost: 0.75,
  },
};
```

---

## 10. Metrics

| Metric | Description |
|--------|-------------|
| `tts_generation_duration_ms` | Time to generate audio |
| `tts_audio_duration_sec` | Length of generated audio |
| `tts_chars_processed` | Characters sent to TTS |
| `tts_provider_used` | Which provider was used |
| `tts_cost_estimate` | Estimated cost |

---

## 11. Files

| File | Purpose |
|------|---------|
| `apps/worker/src/pipeline/steps/generate-voice.ts` | Main TTS logic |
| `apps/worker/src/pipeline/steps/tts.ts` | Provider abstraction |
| `apps/worker/src/pipeline/steps/tts-providers/openai.ts` | OpenAI TTS |
| `apps/worker/src/pipeline/steps/tts-providers/elevenlabs.ts` | ElevenLabs |
| `apps/api/src/index.ts` | Voice profile upload endpoint |

---

## 12. System Integration

### Communicates With

| Subsystem | Direction | Mechanism | Purpose |
|-----------|-----------|-----------|---------|
| **Pipeline** | Pipeline → Voice | Function call | Trigger generation |
| **Script** | Script → Voice | Context artifacts | Provide narration text |
| **Alignment** | Voice → Alignment | Context artifacts | Provide audio file |
| **Render** | Voice → Render | Context artifacts | Provide audio track |
| **Storage** | Voice → Storage | Supabase client | Upload audio file |
| **OpenAI/ElevenLabs** | Voice → External | HTTP API | TTS generation |

### Inbound Interfaces

```typescript
// From Script (via ctx.artifacts)
const narrationText = ctx.artifacts.script.narrationText;

// From Pipeline: Voice generation request
interface VoiceInput {
  text: string;              // From script.narrationText
  voiceId: string;           // From project settings or default
  provider: 'openai' | 'elevenlabs';
  speed?: number;
}
```

### Outbound Interfaces

```typescript
// To Alignment subsystem (via ctx.artifacts)
ctx.artifacts.narrationPath = '/path/to/audio.mp3';
ctx.artifacts.narrationDurationMs = 125000;

// To Storage: Upload audio
await supabase.storage
  .from('temp-processing')
  .upload(`${ctx.jobId}/narration.mp3`, audioBuffer);

// To External TTS API
const audio = await openai.audio.speech.create({
  model: 'tts-1-hd',
  voice: voiceId,
  input: narrationText
});
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                       VOICE SUBSYSTEM                            │
│                                                                 │
│  ┌──────────────┐                      ┌──────────────────┐    │
│  │   Script     │─── narrationText ───►│  Text Preprocess │    │
│  │  Artifacts   │                      │  (clean, chunk)  │    │
│  └──────────────┘                      └────────┬─────────┘    │
│                                                 │               │
│                                                 ▼               │
│                                        ┌──────────────────┐    │
│                                        │  TTS Provider    │    │
│                                        │ ┌──────────────┐ │    │
│                                        │ │   OpenAI     │ │    │
│                                        │ │   or         │ │    │
│                                        │ │  ElevenLabs  │ │    │
│                                        │ └──────────────┘ │    │
│                                        └────────┬─────────┘    │
│                                                 │               │
│                                                 ▼               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                ctx.artifacts                              │  │
│  │  narrationPath: '/jobs/xxx/audio.mp3'                    │  │
│  │  narrationDurationMs: 125000                             │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
       ┌───────────┐                   ┌───────────┐
       │ ALIGNMENT │                   │  RENDER   │
       │ (extracts │                   │ (uses as  │
       │ timestamps)│                  │ audio trk)│
       └───────────┘                   └───────────┘
```
