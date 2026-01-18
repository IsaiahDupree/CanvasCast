# PRD: Script Generation (LLM)

**Subsystem:** Scripting  
**Version:** 1.0  
**Status:** Implemented  
**Owner:** Isaiah  

---

## 1. Overview

The Script Generation subsystem transforms user prompts into structured video scripts using LLM (OpenAI/Anthropic). The output includes narration text, scene breakdowns, and visual cues optimized for the "Narrated Storyboard" format.

### Business Goal
Convert raw user ideas into production-ready scripts that feel professionally written while maintaining the user's intent.

---

## 2. User Stories

### US-1: Prompt to Script
**As a** user  
**I want to** enter a simple prompt  
**So that** I get a complete video script without writing it myself

### US-2: Transcript Override
**As a** user  
**I want to** paste my own transcript  
**So that** I maintain full control over the narration

### US-3: Niche Optimization
**As a** user  
**I want** scripts tailored to my niche (motivation, explainer, etc.)  
**So that** the tone matches my content style

---

## 3. Input/Output

### Input
```typescript
interface ScriptInput {
  prompt: string;           // User's raw idea (10-500 chars)
  transcriptMode: 'auto' | 'manual';
  transcriptText?: string;  // If manual mode
  nichePreset: string;      // e.g., 'motivation', 'explainer'
  targetMinutes: number;    // 1-10 minutes
  templateId: string;       // 'narrated_storyboard_v1'
}
```

### Output
```typescript
interface ScriptOutput {
  title: string;
  description: string;
  narrationText: string;    // Full narration (spoken words)
  scenes: Scene[];
  metadata: {
    estimatedDurationSec: number;
    wordCount: number;
    sceneCount: number;
  };
}

interface Scene {
  sceneId: string;          // 's1', 's2', etc.
  title: string;            // Scene name
  narrationSegment: string; // Words spoken in this scene
  caption: string;          // On-screen text overlay
  imagePrompt: string;      // Visual generation prompt
  visualStyle: string;      // Style hints
  estimatedDurationSec: number;
}
```

---

## 4. LLM Prompt Engineering

### System Prompt
```
You are a professional video scriptwriter specializing in short-form 
vertical content (TikTok, YouTube Shorts, Instagram Reels).

Your task is to create engaging scripts for the "{niche}" niche.

Output Format: JSON matching the ScriptOutput schema exactly.

Guidelines:
- Hook viewers in the first 3 seconds
- Use conversational, punchy language
- Break into 6-12 scenes of 3-8 seconds each
- Each scene should have ONE clear visual
- Captions should be 5-10 words max
- Image prompts should be detailed and specific
- Total duration: approximately {targetMinutes} minutes
```

### User Prompt Template
```
Create a video script based on this idea:

"{prompt}"

Requirements:
- Niche: {niche}
- Target duration: {targetMinutes} minutes
- Style: {templateStyle}
- Tone: {nicheTone}

Return valid JSON only.
```

### Niche-Specific Tones

| Niche | Tone | Style Notes |
|-------|------|-------------|
| motivation | Inspiring, energetic | Power words, call to action |
| explainer | Clear, educational | Step-by-step, simple language |
| facts | Surprising, engaging | "Did you know..." hooks |
| history | Dramatic, storytelling | Narrative arc, tension |
| finance | Authoritative, practical | Numbers, actionable tips |
| science | Curious, wonder-filled | Questions, discoveries |

---

## 5. Functional Requirements

### FR-1: Auto Script Generation

**When:** `transcriptMode === 'auto'`

**Process:**
1. Build LLM prompt with niche context
2. Call OpenAI GPT-4 (or Claude)
3. Parse JSON response
4. Validate against schema
5. Calculate word counts and durations
6. Return structured script

**Retry Logic:**
- Max 3 attempts
- Retry on JSON parse failure
- Retry on validation errors

### FR-2: Manual Transcript Processing

**When:** `transcriptMode === 'manual'`

**Process:**
1. Use provided transcript as narration
2. Auto-segment into scenes (by paragraph or ~30 words)
3. Generate image prompts for each segment
4. Generate captions (first 5-10 words of segment)
5. Return structured script

### FR-3: Script Validation

```typescript
function validateScript(script: ScriptOutput): ValidationResult {
  const errors: string[] = [];
  
  if (script.scenes.length < 3) errors.push('Too few scenes');
  if (script.scenes.length > 20) errors.push('Too many scenes');
  if (!script.narrationText) errors.push('Missing narration');
  
  for (const scene of script.scenes) {
    if (!scene.imagePrompt) errors.push(`Scene ${scene.sceneId} missing image prompt`);
    if (!scene.narrationSegment) errors.push(`Scene ${scene.sceneId} missing narration`);
  }
  
  return { valid: errors.length === 0, errors };
}
```

---

## 6. Duration Estimation

### Words Per Minute
- Default: 150 WPM (conversational pace)
- Fast: 180 WPM
- Slow: 120 WPM

### Calculation
```typescript
function estimateDuration(text: string, wpm = 150): number {
  const words = text.split(/\s+/).length;
  return Math.ceil((words / wpm) * 60); // seconds
}
```

### Scene Duration
```typescript
function calculateSceneDurations(scenes: Scene[]): Scene[] {
  return scenes.map(scene => ({
    ...scene,
    estimatedDurationSec: estimateDuration(scene.narrationSegment)
  }));
}
```

---

## 7. Image Prompt Enhancement

Raw scene descriptions are enhanced for better image generation:

```typescript
function enhanceImagePrompt(
  basic: string, 
  style: string, 
  niche: string
): string {
  const stylePrefix = {
    motivation: 'Cinematic, dramatic lighting, powerful composition,',
    explainer: 'Clean, minimal, infographic-style,',
    facts: 'Vivid, eye-catching, high contrast,',
    history: 'Historical, sepia-toned, archival feel,',
  };
  
  return `${stylePrefix[niche]} ${basic}, ${style}, 
    high quality, 4K, professional photography`;
}
```

---

## 8. Error Handling

| Error | Cause | Recovery |
|-------|-------|----------|
| LLM timeout | API latency | Retry with shorter prompt |
| Invalid JSON | LLM format error | Retry with stricter prompt |
| Rate limited | API quota | Backoff and retry |
| Content filtered | Policy violation | Fail job with explanation |

---

## 9. Configuration

```typescript
const SCRIPT_CONFIG = {
  model: 'gpt-4-turbo-preview',
  temperature: 0.7,
  maxTokens: 4096,
  timeoutMs: 60000,
  maxRetries: 3,
  
  // Scene constraints
  minScenes: 3,
  maxScenes: 20,
  minSceneDuration: 2,  // seconds
  maxSceneDuration: 15, // seconds
  
  // Word constraints  
  maxWordsPerScene: 50,
  wordsPerMinute: 150,
};
```

---

## 10. Caching

Scripts are cached by hash of:
- Prompt text
- Niche preset
- Target minutes
- Template ID

Cache TTL: 24 hours

```typescript
function getScriptCacheKey(input: ScriptInput): string {
  return crypto.createHash('sha256')
    .update(JSON.stringify({
      prompt: input.prompt,
      niche: input.nichePreset,
      minutes: input.targetMinutes,
      template: input.templateId
    }))
    .digest('hex');
}
```

---

## 11. Metrics

| Metric | Description |
|--------|-------------|
| `script_generation_duration_ms` | Time to generate script |
| `script_retry_count` | Retries needed |
| `script_word_count` | Words in final script |
| `script_scene_count` | Scenes generated |
| `llm_tokens_used` | Token consumption |

---

## 12. Files

| File | Purpose |
|------|---------|
| `apps/worker/src/pipeline/steps/scripting.ts` | Main script generation |
| `apps/worker/src/pipeline/steps/generate-script.ts` | LLM interaction |
| `apps/worker/src/lib/llm.ts` | OpenAI/Anthropic client |

---

## 13. System Integration

### Communicates With

| Subsystem | Direction | Mechanism | Purpose |
|-----------|-----------|-----------|---------|
| **Pipeline** | Pipeline → Script | Function call | Trigger generation |
| **Voice** | Script → Voice | Context artifacts | Provide narration text |
| **Image** | Script → Image | Context artifacts | Provide scene prompts |
| **OpenAI/Anthropic** | Script → External | HTTP API | LLM generation |
| **Redis** | Script ↔ Cache | Key-value | Script caching |

### Inbound Interfaces

```typescript
// From Pipeline: Generate script request
interface ScriptInput {
  prompt: string;           // From project.prompt_text or draft
  nichePreset: string;      // From project.niche_preset
  targetMinutes: number;    // From project.target_minutes
  transcriptMode: 'auto' | 'manual';
  transcriptText?: string;  // If manual mode
}

// Called by pipeline runner
const result = await generateScript(ctx);
// ctx contains: ctx.project.prompt_text, ctx.project.niche_preset, etc.
```

### Outbound Interfaces

```typescript
// To Voice subsystem (via ctx.artifacts)
ctx.artifacts.script = {
  title: string;
  description: string;
  narrationText: string;  // Voice step uses this
  scenes: Scene[];        // Image step uses this
  metadata: { ... };
};

// To External LLM API
const response = await openai.chat.completions.create({
  model: 'gpt-4-turbo-preview',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ],
  response_format: { type: 'json_object' }
});
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      SCRIPT SUBSYSTEM                            │
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │   Pipeline   │────►│  Check Cache │────►│  LLM Call    │    │
│  │   Context    │     │  (Redis)     │     │  (OpenAI)    │    │
│  └──────────────┘     └──────────────┘     └──────┬───────┘    │
│         │                    │                     │            │
│         │                    │ cache hit           │            │
│         │                    ▼                     ▼            │
│         │              ┌──────────────┐     ┌──────────────┐   │
│         │              │  Return      │     │  Parse JSON  │   │
│         │              │  Cached      │     │  Validate    │   │
│         │              └──────┬───────┘     └──────┬───────┘   │
│         │                     │                     │           │
│         ▼                     ▼                     ▼           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              ctx.artifacts.script                        │   │
│  │  { title, narrationText, scenes[], metadata }           │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
       ┌───────────┐                   ┌───────────┐
       │   VOICE   │                   │   IMAGE   │
       │ (uses     │                   │ (uses     │
       │ narration)│                   │ scenes[]) │
       └───────────┘                   └───────────┘
```
