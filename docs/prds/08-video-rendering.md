# PRD: Video Rendering (Remotion)

**Subsystem:** Rendering  
**Version:** 1.0  
**Status:** Implemented  
**Owner:** Isaiah  

---

## 1. Overview

The Video Rendering subsystem uses Remotion to compose final MP4 videos from generated assets (images, audio, captions). It runs in a containerized environment with Chromium for headless rendering, producing YouTube-ready output.

### Business Goal
Produce professional, platform-optimized videos that render reliably at scale without manual intervention.

---

## 2. User Stories

### US-1: Automatic Video Assembly
**As a** user  
**I want** my video automatically assembled  
**So that** I don't need video editing skills

### US-2: Platform Optimization
**As a** user  
**I want** videos sized for YouTube/TikTok  
**So that** I can upload directly without conversion

### US-3: Caption Burn-In
**As a** user  
**I want** captions embedded in the video  
**So that** viewers can watch without sound

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Remotion Composition                      │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    <Video>                               │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │ │
│  │  │   Scene 1   │  │   Scene 2   │  │   Scene N   │ ...  │ │
│  │  │  ┌───────┐  │  │  ┌───────┐  │  │  ┌───────┐  │      │ │
│  │  │  │ Image │  │  │  │ Image │  │  │  │ Image │  │      │ │
│  │  │  └───────┘  │  │  └───────┘  │  │  └───────┘  │      │ │
│  │  │  ┌───────┐  │  │  ┌───────┐  │  │  ┌───────┐  │      │ │
│  │  │  │Caption│  │  │  │Caption│  │  │  │Caption│  │      │ │
│  │  │  └───────┘  │  │  └───────┘  │  │  └───────┘  │      │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘      │ │
│  │  ┌──────────────────────────────────────────────────┐   │ │
│  │  │                Audio Track                        │   │ │
│  │  └──────────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Input/Output

### Input (Timeline)
```typescript
interface RenderInput {
  timeline: VideoTimeline;
  outputPath: string;
  config: RenderConfig;
}

interface VideoTimeline {
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  scenes: TimelineScene[];
  audio: {
    src: string;
    startFrom: number;
    volume: number;
  };
}

interface TimelineScene {
  id: string;
  from: number;              // Start frame
  durationInFrames: number;
  image: {
    src: string;
    motion: MotionConfig;
  };
  caption: {
    text: string;
    words: CaptionWord[];
    style: CaptionStyle;
  };
  transition: {
    in: 'fade' | 'slide' | 'cut';
    out: 'fade' | 'slide' | 'cut';
    durationInFrames: number;
  };
}
```

### Output
```typescript
interface RenderOutput {
  videoPath: string;
  durationSec: number;
  fileSizeBytes: number;
  resolution: string;
  fps: number;
  codec: string;
}
```

---

## 5. Remotion Composition

### Main Component
```tsx
// packages/remotion/src/VideoComposition.tsx

export const VideoComposition: React.FC<VideoProps> = ({ timeline }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Audio Track */}
      <Audio src={timeline.audio.src} volume={timeline.audio.volume} />
      
      {/* Scene Sequence */}
      {timeline.scenes.map((scene, index) => (
        <Sequence
          key={scene.id}
          from={scene.from}
          durationInFrames={scene.durationInFrames}
        >
          <SceneComponent scene={scene} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
```

### Scene Component
```tsx
const SceneComponent: React.FC<{ scene: TimelineScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Calculate motion
  const progress = frame / scene.durationInFrames;
  const transform = calculateMotion(scene.image.motion, progress);
  
  // Fade transitions
  const opacity = interpolate(
    frame,
    [0, 15, scene.durationInFrames - 15, scene.durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  
  return (
    <AbsoluteFill style={{ opacity }}>
      {/* Background Image with Motion */}
      <Img
        src={scene.image.src}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform,
        }}
      />
      
      {/* Caption Overlay */}
      <CaptionOverlay
        words={scene.caption.words}
        style={scene.caption.style}
        currentFrame={frame}
        fps={fps}
      />
    </AbsoluteFill>
  );
};
```

### Caption Component
```tsx
const CaptionOverlay: React.FC<CaptionProps> = ({ 
  words, 
  style, 
  currentFrame,
  fps 
}) => {
  const currentTime = currentFrame / fps;
  
  // Find active words
  const activeWords = words.filter(
    w => currentTime >= w.start && currentTime <= w.end
  );
  
  // Build display text with highlighting
  const displayWords = words.map(word => ({
    ...word,
    isActive: activeWords.some(aw => aw.word === word.word),
  }));
  
  return (
    <div style={captionContainerStyle}>
      <div style={{ ...captionTextStyle, ...style }}>
        {displayWords.map((word, i) => (
          <span
            key={i}
            style={{
              color: word.isActive ? style.activeColor : style.color,
              fontWeight: word.isActive ? 'bold' : 'normal',
            }}
          >
            {word.word}{' '}
          </span>
        ))}
      </div>
    </div>
  );
};
```

---

## 6. Motion Effects

### Ken Burns (Pan/Zoom)
```typescript
type MotionType = 'pan_left' | 'pan_right' | 'zoom_in' | 'zoom_out' | 'static';

interface MotionConfig {
  type: MotionType;
  intensity: number; // 0-1
}

function calculateMotion(config: MotionConfig, progress: number): string {
  const { type, intensity } = config;
  const amount = intensity * 0.1; // 10% max movement
  
  switch (type) {
    case 'pan_left':
      return `translateX(${interpolate(progress, [0, 1], [0, -amount * 100])}%) scale(1.1)`;
    case 'pan_right':
      return `translateX(${interpolate(progress, [0, 1], [-amount * 100, 0])}%) scale(1.1)`;
    case 'zoom_in':
      return `scale(${interpolate(progress, [0, 1], [1, 1 + amount])})`;
    case 'zoom_out':
      return `scale(${interpolate(progress, [0, 1], [1 + amount, 1])})`;
    default:
      return 'scale(1.05)';
  }
}
```

---

## 7. Render Pipeline

### Build Timeline
```typescript
async function buildTimeline(ctx: PipelineContext): Promise<VideoTimeline> {
  const { script, whisperSegments, imagePaths, narrationPath } = ctx.artifacts;
  const fps = 30;
  
  let currentFrame = 0;
  const scenes: TimelineScene[] = [];
  
  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    const sceneWords = getSceneWords(whisperSegments, scene);
    const durationSec = sceneWords.length > 0 
      ? sceneWords[sceneWords.length - 1].end - sceneWords[0].start
      : 3;
    const durationInFrames = Math.ceil(durationSec * fps);
    
    scenes.push({
      id: scene.sceneId,
      from: currentFrame,
      durationInFrames,
      image: {
        src: imagePaths[i],
        motion: { type: getMotionType(i), intensity: 0.5 },
      },
      caption: {
        text: scene.caption,
        words: sceneWords.map(w => ({
          word: w.word,
          start: w.start - sceneWords[0].start,
          end: w.end - sceneWords[0].start,
        })),
        style: getCaptionStyle(ctx.project.nichePreset),
      },
      transition: {
        in: i === 0 ? 'fade' : 'cut',
        out: 'cut',
        durationInFrames: 15,
      },
    });
    
    currentFrame += durationInFrames;
  }
  
  return {
    durationInFrames: currentFrame,
    fps,
    width: 1080,
    height: 1920,
    scenes,
    audio: {
      src: narrationPath,
      startFrom: 0,
      volume: 1,
    },
  };
}
```

### Render Execution
```typescript
async function renderVideo(ctx: PipelineContext): Promise<RenderOutput> {
  const { timeline } = ctx.artifacts;
  const outputPath = `${ctx.outputPath}/video.mp4`;
  
  // Write timeline as input props
  await fs.writeFile(
    `${ctx.basePath}/timeline.json`,
    JSON.stringify(timeline)
  );
  
  // Execute Remotion render
  await bundle({
    entryPoint: require.resolve('@canvascast/remotion'),
    outDir: `${ctx.basePath}/bundle`,
  });
  
  await renderMedia({
    composition: await selectComposition({
      serveUrl: `${ctx.basePath}/bundle`,
      id: 'VideoComposition',
      inputProps: { timeline },
    }),
    serveUrl: `${ctx.basePath}/bundle`,
    codec: 'h264',
    outputLocation: outputPath,
    chromiumOptions: {
      enableMultiProcessOnLinux: true,
    },
    concurrency: 2,
  });
  
  const stats = await fs.stat(outputPath);
  
  return {
    videoPath: outputPath,
    durationSec: timeline.durationInFrames / timeline.fps,
    fileSizeBytes: stats.size,
    resolution: `${timeline.width}x${timeline.height}`,
    fps: timeline.fps,
    codec: 'h264',
  };
}
```

---

## 8. Caption Styles

```typescript
interface CaptionStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  activeColor: string;
  backgroundColor: string;
  padding: string;
  position: 'top' | 'center' | 'bottom';
  animation: 'highlight' | 'typewriter' | 'bounce';
}

const CAPTION_PRESETS: Record<string, CaptionStyle> = {
  motivation: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 48,
    color: '#ffffff',
    activeColor: '#ffcc00',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: '12px 24px',
    position: 'bottom',
    animation: 'highlight',
  },
  explainer: {
    fontFamily: 'Inter, sans-serif',
    fontSize: 42,
    color: '#ffffff',
    activeColor: '#00d4ff',
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: '8px 16px',
    position: 'bottom',
    animation: 'typewriter',
  },
  facts: {
    fontFamily: 'Poppins, sans-serif',
    fontSize: 52,
    color: '#ffffff',
    activeColor: '#ff6b6b',
    backgroundColor: 'transparent',
    padding: '0',
    position: 'center',
    animation: 'bounce',
  },
};
```

---

## 9. Output Specifications

### Video Format
| Property | Value |
|----------|-------|
| Container | MP4 |
| Video Codec | H.264 (High Profile) |
| Audio Codec | AAC |
| Resolution | 1080x1920 (9:16) |
| Frame Rate | 30 fps |
| Bitrate | 8 Mbps |
| Audio | 128 kbps stereo |

### Platform Compatibility
- YouTube Shorts ✓
- TikTok ✓
- Instagram Reels ✓
- Facebook Stories ✓

---

## 10. Container Environment

### Dockerfile
```dockerfile
FROM node:20-slim

# Install Chromium dependencies
RUN apt-get update && apt-get install -y \
  chromium \
  fonts-liberation \
  libnss3 \
  libatk-bridge2.0-0 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  && rm -rf /var/lib/apt/lists/*

# Set Puppeteer env
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY . .
RUN pnpm install
RUN pnpm build

CMD ["node", "dist/index.js"]
```

---

## 11. Error Handling

| Error | Cause | Recovery |
|-------|-------|----------|
| Chromium crash | Memory exhaustion | Reduce concurrency |
| Render timeout | Too long video | Increase timeout |
| Missing asset | File not found | Fail job with details |
| Codec error | FFmpeg issue | Retry with different params |

---

## 12. Metrics

| Metric | Description |
|--------|-------------|
| `render_duration_ms` | Time to render |
| `render_frame_rate` | Frames/second during render |
| `render_output_size_mb` | Final file size |
| `render_memory_peak_mb` | Memory usage |

---

## 13. Files

| File | Purpose |
|------|---------|
| `apps/worker/src/pipeline/steps/render-video.ts` | Render orchestration |
| `apps/worker/src/pipeline/steps/build-timeline.ts` | Timeline construction |
| `apps/worker/src/pipeline/steps/remotion.ts` | Remotion integration |
| `packages/remotion/src/VideoComposition.tsx` | Main composition |
| `packages/remotion/src/components/` | Scene, Caption components |

---

## 14. System Integration

### Communicates With

| Subsystem | Direction | Mechanism | Purpose |
|-----------|-----------|-----------|---------|
| **Pipeline** | Pipeline → Render | Function call | Trigger render |
| **Voice** | Voice → Render | Context artifacts | Audio track |
| **Alignment** | Alignment → Render | Context artifacts | Word timestamps |
| **Image** | Image → Render | Context artifacts | Scene images |
| **Script** | Script → Render | Context artifacts | Scene structure |
| **Packaging** | Render → Packaging | Context artifacts | Video file |
| **Storage** | Render → Storage | File system | Temp files |

### Inbound Interfaces

```typescript
// From all previous steps (via ctx.artifacts)
const {
  narrationPath,      // From Voice
  narrationDurationMs,
  whisperSegments,    // From Alignment
  imagePaths,         // From Image
  script              // From Script
} = ctx.artifacts;

// Pipeline calls render
const result = await renderVideo(ctx);
```

### Outbound Interfaces

```typescript
// To Packaging subsystem (via ctx.artifacts)
ctx.artifacts.videoPath = '/jobs/xxx/video.mp4';
ctx.artifacts.timeline = timelineData;

// Remotion render call
await renderMedia({
  composition: videoComposition,
  codec: 'h264',
  outputLocation: outputPath,
  inputProps: { timeline }
});
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      RENDER SUBSYSTEM                            │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Voice   │  │ Alignment│  │  Image   │  │  Script  │        │
│  │ (audio)  │  │(segments)│  │ (images) │  │ (scenes) │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │             │             │             │               │
│       └─────────────┴─────────────┴─────────────┘               │
│                           │                                     │
│                           ▼                                     │
│                  ┌──────────────────┐                           │
│                  │  Build Timeline  │                           │
│                  │  (JSON props)    │                           │
│                  └────────┬─────────┘                           │
│                           │                                     │
│                           ▼                                     │
│                  ┌──────────────────┐                           │
│                  │    Remotion      │                           │
│                  │   renderMedia()  │                           │
│                  └────────┬─────────┘                           │
│                           │                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    ctx.artifacts                          │  │
│  │  videoPath: '/jobs/xxx/video.mp4'                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                       ┌───────────┐
                       │ PACKAGING │
                       │ (bundle   │
                       │ video)    │
                       └───────────┘
```

### Timeline Assembly

All artifacts are combined into a Remotion-compatible timeline:

```typescript
interface TimelineAssembly {
  // From Voice
  audio: { src: narrationPath, volume: 1 };
  
  // From Script + Alignment + Image
  scenes: script.scenes.map((scene, i) => ({
    from: calculateFrame(whisperSegments, scene),
    durationInFrames: calculateDuration(scene),
    image: { src: imagePaths[i] },
    caption: { words: getSceneWords(whisperSegments, scene) }
  }));
}
```
