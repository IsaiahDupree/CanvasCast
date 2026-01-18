# CanvasCast Video Generation Pipeline

## Overview
Transform user inputs (niche, content, voice) into professional YouTube videos using AI-powered generation and Remotion rendering.

---

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Video Rendering** | Remotion | Programmatic video composition |
| **Script Generation** | OpenAI GPT-4 / Claude | Generate engaging scripts |
| **Voice Synthesis** | ElevenLabs / OpenAI TTS | Convert script to speech |
| **Voice Cloning** | ElevenLabs | Clone user's voice from samples |
| **Image Generation** | DALL-E 3 / Flux / Replicate | Generate visuals for scenes |
| **Caption Generation** | Whisper | Word-level timestamps for captions |
| **Background Music** | Pixabay / Epidemic Sound API | Royalty-free music |
| **Job Queue** | BullMQ + Redis | Manage generation pipeline |
| **Storage** | Supabase Storage | Store assets and outputs |

---

## Pipeline Stages

### Stage 1: SCRIPTING
**Generate video script from user input**

```
Input:  title, niche, target_minutes, user_notes
Output: structured script with scenes
```

**Features:**
- [ ] Niche-specific prompt templates (motivation, explainer, facts, etc.)
- [ ] Scene breakdown with timing estimates
- [ ] Hook generation for first 5 seconds
- [ ] Call-to-action generation
- [ ] SEO-optimized title/description suggestions
- [ ] Structured JSON output for downstream processing

**Script Structure:**
```json
{
  "title": "Why Most People Fail at YouTube",
  "scenes": [
    {
      "id": 1,
      "type": "hook",
      "duration_sec": 5,
      "narration": "What if I told you...",
      "visual_prompt": "dramatic close-up, person looking at camera",
      "transition": "fade"
    }
  ],
  "total_duration_sec": 480,
  "music_mood": "inspirational",
  "pacing": "medium"
}
```

---

### Stage 2: VOICE_GEN
**Convert script to speech**

```
Input:  script scenes, voice_profile_id (optional)
Output: audio files with timing metadata
```

**Features:**
- [ ] Default AI voices (male/female options)
- [ ] Custom voice cloning from user samples
- [ ] Emotion/tone control per scene
- [ ] Speed adjustment (0.8x - 1.2x)
- [ ] Pause insertion between scenes
- [ ] Audio normalization

**Voice Providers:**
| Provider | Use Case | Cost |
|----------|----------|------|
| OpenAI TTS | Default voices, fast | $0.015/1K chars |
| ElevenLabs | Voice cloning, premium | $0.30/1K chars |
| Azure TTS | Multilingual | $0.016/1K chars |

---

### Stage 3: ALIGNMENT
**Generate word-level timestamps**

```
Input:  audio files
Output: word-level timestamps for captions
```

**Features:**
- [ ] Whisper transcription with timestamps
- [ ] Word-level alignment for animated captions
- [ ] Sentence grouping for caption display
- [ ] Timing adjustment for natural reading

**Output Format:**
```json
{
  "words": [
    { "word": "What", "start": 0.0, "end": 0.2 },
    { "word": "if", "start": 0.2, "end": 0.35 }
  ],
  "sentences": [
    { "text": "What if I told you", "start": 0.0, "end": 1.2 }
  ]
}
```

---

### Stage 4: VISUAL_PLAN
**Plan visuals for each scene**

```
Input:  script scenes, niche
Output: image prompts and layout instructions
```

**Features:**
- [ ] Scene-to-prompt conversion
- [ ] Consistent style across video (style tokens)
- [ ] Image count based on scene duration (1 per 6-8 sec)
- [ ] Ken Burns effect directions (zoom in/out, pan)
- [ ] B-roll suggestions from stock libraries
- [ ] Text overlay planning

**Visual Styles by Niche:**
| Niche | Style | Colors |
|-------|-------|--------|
| Motivation | Cinematic, dramatic lighting | Gold, black, white |
| Explainer | Clean, minimal, icons | Blue, white |
| Facts | Bold, infographic style | Bright, contrasting |
| Documentary | Realistic, historical | Muted, sepia tones |

---

### Stage 5: IMAGE_GEN
**Generate images for scenes**

```
Input:  visual plan with prompts
Output: generated images
```

**Features:**
- [ ] Batch image generation
- [ ] Style consistency (seed/style reference)
- [ ] Multiple aspect ratios (16:9, 9:16, 1:1)
- [ ] Upscaling for 1080p+ output
- [ ] Fallback to stock images on failure
- [ ] Image caching for reuse

**Providers:**
| Provider | Quality | Speed | Cost |
|----------|---------|-------|------|
| DALL-E 3 | High | Medium | $0.04/image |
| Flux (Replicate) | Very High | Slow | $0.02/image |
| Midjourney | Premium | Medium | $0.05/image |
| Stable Diffusion | Good | Fast | $0.01/image |

---

### Stage 6: TIMELINE_BUILD
**Assemble Remotion timeline**

```
Input:  audio, images, captions, script
Output: Remotion composition JSON
```

**Features:**
- [ ] Scene sequencing with transitions
- [ ] Audio track alignment
- [ ] Caption overlay positioning
- [ ] Ken Burns animation keyframes
- [ ] Background music mixing
- [ ] Intro/outro templates
- [ ] Watermark/branding options

**Remotion Composition:**
```tsx
<Composition
  id="YouTubeVideo"
  component={VideoComposition}
  durationInFrames={fps * totalSeconds}
  fps={30}
  width={1920}
  height={1080}
/>
```

---

### Stage 7: RENDERING
**Render final video with Remotion**

```
Input:  Remotion composition
Output: MP4 video file
```

**Features:**
- [ ] 1080p default, 4K optional
- [ ] 30fps default, 60fps optional
- [ ] H.264 codec for compatibility
- [ ] Progress tracking (frame-by-frame)
- [ ] Render on cloud (Lambda/Cloud Run)
- [ ] Parallel rendering for speed

**Render Options:**
| Quality | Resolution | Bitrate | Est. Time (10 min) |
|---------|------------|---------|-------------------|
| Standard | 1080p | 8 Mbps | ~5 min |
| High | 1080p | 12 Mbps | ~7 min |
| 4K | 2160p | 25 Mbps | ~15 min |

---

### Stage 8: PACKAGING
**Prepare deliverables**

```
Input:  rendered video, assets
Output: downloadable package
```

**Deliverables:**
- [ ] Final MP4 video
- [ ] SRT caption file
- [ ] VTT caption file
- [ ] Thumbnail image (auto-generated)
- [ ] Script PDF
- [ ] YouTube metadata (title, description, tags)
- [ ] Asset pack (images, audio) - optional

---

## Remotion Components

### Core Components to Build

```
packages/remotion/
├── src/
│   ├── compositions/
│   │   ├── YouTubeVideo.tsx      # Main composition
│   │   ├── ShortVideo.tsx        # YouTube Shorts (9:16)
│   │   └── Thumbnail.tsx         # Thumbnail generator
│   ├── components/
│   │   ├── Scene.tsx             # Single scene wrapper
│   │   ├── AnimatedCaption.tsx   # Word-by-word captions
│   │   ├── KenBurnsImage.tsx     # Animated background
│   │   ├── TextOverlay.tsx       # Title/text cards
│   │   ├── ProgressBar.tsx       # Video progress indicator
│   │   └── Transition.tsx        # Scene transitions
│   ├── templates/
│   │   ├── MotivationTemplate.tsx
│   │   ├── ExplainerTemplate.tsx
│   │   └── DocumentaryTemplate.tsx
│   └── utils/
│       ├── timing.ts             # Frame/time calculations
│       ├── easing.ts             # Animation curves
│       └── fonts.ts              # Font loading
```

### Caption Styles

```tsx
// Animated word-by-word captions (TikTok/YouTube style)
const AnimatedCaption = ({ words, currentFrame, fps }) => {
  const currentTime = currentFrame / fps;
  
  return (
    <div className="caption-container">
      {words.map((word, i) => {
        const isActive = currentTime >= word.start && currentTime < word.end;
        const isPast = currentTime >= word.end;
        
        return (
          <span
            key={i}
            className={cn(
              "caption-word",
              isActive && "active",
              isPast && "past"
            )}
          >
            {word.word}
          </span>
        );
      })}
    </div>
  );
};
```

---

## Worker Pipeline Implementation

```typescript
// apps/worker/src/pipeline/stages.ts

export const PIPELINE_STAGES = [
  { name: 'SCRIPTING',      handler: generateScript,     creditCost: 0 },
  { name: 'VOICE_GEN',      handler: generateVoice,      creditCost: 0.3 },
  { name: 'ALIGNMENT',      handler: alignCaptions,      creditCost: 0 },
  { name: 'VISUAL_PLAN',    handler: planVisuals,        creditCost: 0 },
  { name: 'IMAGE_GEN',      handler: generateImages,     creditCost: 0.5 },
  { name: 'TIMELINE_BUILD', handler: buildTimeline,      creditCost: 0 },
  { name: 'RENDERING',      handler: renderVideo,        creditCost: 0.2 },
  { name: 'PACKAGING',      handler: packageDeliverables, creditCost: 0 },
] as const;

// Total: 1 credit per minute of video
```

---

## API Integrations Required

| Service | API Key Env Var | Documentation |
|---------|-----------------|---------------|
| OpenAI | `OPENAI_API_KEY` | GPT-4, DALL-E 3, Whisper, TTS |
| ElevenLabs | `ELEVENLABS_API_KEY` | Voice cloning, TTS |
| Replicate | `REPLICATE_API_TOKEN` | Flux, Stable Diffusion |
| Supabase | `SUPABASE_SERVICE_KEY` | Storage, Database |
| Remotion | `REMOTION_LICENSE` | Video rendering |

---

## Cost Breakdown (per 10-min video)

| Stage | Service | Est. Cost |
|-------|---------|-----------|
| Script | GPT-4 | $0.10 |
| Voice | ElevenLabs | $1.50 |
| Images | DALL-E 3 (15 images) | $0.60 |
| Captions | Whisper | $0.06 |
| Render | Cloud compute | $0.30 |
| **Total** | | **~$2.56** |

With 1 credit = $0.30, 10 credits covers costs + margin.

---

## Implementation Priority

### Phase 1: MVP (Week 1-2)
- [ ] Script generation with OpenAI
- [ ] OpenAI TTS (default voices only)
- [ ] Whisper alignment
- [ ] DALL-E 3 image generation
- [ ] Basic Remotion composition
- [ ] 1080p rendering
- [ ] MP4 + SRT output

### Phase 2: Enhanced (Week 3-4)
- [ ] ElevenLabs voice cloning
- [ ] Multiple caption styles
- [ ] Ken Burns animations
- [ ] Background music
- [ ] Thumbnail generation
- [ ] YouTube Shorts format

### Phase 3: Premium (Week 5-6)
- [ ] Flux/Midjourney integration
- [ ] 4K rendering
- [ ] Custom templates per niche
- [ ] Batch generation
- [ ] A/B thumbnail testing
- [ ] Analytics integration

---

## File Structure After Implementation

```
apps/
├── api/                    # Express API server (done)
├── web/                    # Next.js frontend (done)
├── worker/                 # Job processor
│   └── src/
│       ├── pipeline/
│       │   ├── index.ts
│       │   ├── scripting.ts
│       │   ├── voice.ts
│       │   ├── alignment.ts
│       │   ├── visuals.ts
│       │   ├── images.ts
│       │   ├── timeline.ts
│       │   ├── render.ts
│       │   └── package.ts
│       └── services/
│           ├── openai.ts
│           ├── elevenlabs.ts
│           ├── replicate.ts
│           └── remotion.ts
└── remotion/               # Remotion video package (new)
    ├── src/
    │   ├── Root.tsx
    │   ├── compositions/
    │   └── components/
    ├── remotion.config.ts
    └── package.json
```
