# PRD: Image Generation (Gemini)

**Subsystem:** Visuals  
**Version:** 1.0  
**Status:** Implemented  
**Owner:** Isaiah  

---

## 1. Overview

The Image Generation subsystem creates scene visuals using Google's Gemini API (Imagen). It generates consistent, high-quality images based on enhanced prompts from the script, with support for character consistency through reference images.

### Business Goal
Produce visually compelling, consistent imagery that matches the narration and maintains character/style coherence across scenes.

---

## 2. User Stories

### US-1: Auto Image Generation
**As a** user  
**I want** images generated for each scene  
**So that** I have professional visuals without designing them

### US-2: Style Consistency
**As a** user  
**I want** all images to have a consistent visual style  
**So that** my video looks cohesive

### US-3: Character Consistency (V1)
**As a** user  
**I want to** upload a reference image  
**So that** characters look the same across scenes

---

## 3. Input/Output

### Input
```typescript
interface ImageGenInput {
  scenes: SceneImageRequest[];
  style: StyleConfig;
  referenceImage?: string;     // URL to reference image
  outputFormat: 'png' | 'webp';
  resolution: '1024x1024' | '1024x1792' | '1792x1024';
}

interface SceneImageRequest {
  sceneId: string;
  prompt: string;              // Enhanced image prompt
  negativePrompt?: string;     // What to avoid
  seed?: number;               // For reproducibility
}

interface StyleConfig {
  niche: string;
  visualStyle: string;         // e.g., 'cinematic', 'minimal', 'vibrant'
  colorPalette?: string[];
}
```

### Output
```typescript
interface ImageGenOutput {
  images: GeneratedImage[];
  totalCost: number;
  processingTimeMs: number;
}

interface GeneratedImage {
  sceneId: string;
  url: string;                 // Storage URL
  localPath: string;           // Local file path
  width: number;
  height: number;
  prompt: string;              // Actual prompt used
  seed: number;
}
```

---

## 4. Gemini Imagen Integration

### API Configuration
```typescript
const GEMINI_CONFIG = {
  model: 'imagen-3.0-generate-001',
  apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
  defaultResolution: '1024x1792', // Vertical for shorts
  samplesPerPrompt: 1,
  safetySettings: {
    category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
    threshold: 'BLOCK_MEDIUM_AND_ABOVE',
  },
};
```

### Generation Request
```typescript
async function generateImage(
  prompt: string,
  config: ImageGenConfig
): Promise<GeneratedImageData> {
  const response = await fetch(
    `${GEMINI_CONFIG.apiEndpoint}/models/${GEMINI_CONFIG.model}:generateImages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        prompt: prompt,
        numberOfImages: 1,
        aspectRatio: '9:16',
        safetyFilterLevel: 'block_some',
        personGeneration: 'allow_adult',
      }),
    }
  );

  const data = await response.json();
  return {
    base64: data.generatedImages[0].image.imageBytes,
    mimeType: 'image/png',
  };
}
```

---

## 5. Functional Requirements

### FR-1: Batch Image Generation

**Process:**
1. Receive scene prompts from visual plan
2. Enhance prompts with style context
3. Generate images in parallel (max 3 concurrent)
4. Upload to storage
5. Return URLs and metadata

```typescript
async function generateSceneImages(
  scenes: SceneImageRequest[],
  style: StyleConfig
): Promise<GeneratedImage[]> {
  const results: GeneratedImage[] = [];
  
  // Process in batches of 3
  for (let i = 0; i < scenes.length; i += 3) {
    const batch = scenes.slice(i, i + 3);
    const batchResults = await Promise.all(
      batch.map(scene => generateSingleImage(scene, style))
    );
    results.push(...batchResults);
    
    // Rate limiting pause
    if (i + 3 < scenes.length) {
      await sleep(1000);
    }
  }
  
  return results;
}
```

### FR-2: Prompt Enhancement

Transform basic scene prompts into detailed Gemini prompts:

```typescript
function enhancePrompt(
  basicPrompt: string,
  style: StyleConfig,
  sceneContext: SceneContext
): string {
  const styleModifiers = {
    cinematic: 'cinematic lighting, dramatic shadows, film grain, 35mm',
    minimal: 'clean, minimal, lots of white space, modern design',
    vibrant: 'saturated colors, bold, eye-catching, high contrast',
    documentary: 'photorealistic, natural lighting, authentic',
  };

  const nicheModifiers = {
    motivation: 'inspiring, powerful, emotional impact',
    explainer: 'clear, educational, diagram-style when appropriate',
    facts: 'surprising, vivid, attention-grabbing',
    history: 'period-accurate, archival feel, sepia undertones',
  };

  return `${basicPrompt}. 
    Style: ${styleModifiers[style.visualStyle] || ''}.
    Mood: ${nicheModifiers[style.niche] || ''}.
    High quality, professional, suitable for vertical video (9:16 aspect ratio).
    No text or watermarks.`;
}
```

### FR-3: Character Consistency (V1)

Use reference images to maintain character appearance:

```typescript
async function generateWithReference(
  prompt: string,
  referenceImageUrl: string,
  config: ImageGenConfig
): Promise<GeneratedImageData> {
  // Download reference image
  const referenceBase64 = await downloadAsBase64(referenceImageUrl);
  
  // Use Gemini's image-to-image with reference
  const response = await fetch(
    `${GEMINI_CONFIG.apiEndpoint}/models/imagen-3.0-capability-preview:generateImages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        prompt: `${prompt}. Maintain the same character appearance as the reference.`,
        referenceImages: [{
          referenceType: 'STYLE_REFERENCE',
          referenceImage: { bytesBase64Encoded: referenceBase64 },
        }],
        numberOfImages: 1,
        aspectRatio: '9:16',
      }),
    }
  );

  return response.json();
}
```

### FR-4: Negative Prompts

Avoid common issues:

```typescript
const DEFAULT_NEGATIVE_PROMPT = `
  blurry, low quality, pixelated, watermark, text overlay,
  distorted faces, extra limbs, bad anatomy, 
  nsfw, violence, gore, offensive content,
  logo, brand names, copyrighted characters
`;

function buildNegativePrompt(
  customNegatives: string[],
  niche: string
): string {
  const nicheNegatives = {
    motivation: 'sad, depressing, dark mood',
    explainer: 'confusing, cluttered, busy background',
    facts: 'boring, mundane, generic',
  };

  return [
    DEFAULT_NEGATIVE_PROMPT,
    nicheNegatives[niche] || '',
    ...customNegatives,
  ].join(', ');
}
```

---

## 6. Visual Planning

Before generation, plan the visual sequence:

```typescript
interface VisualPlan {
  scenes: PlannedScene[];
  globalStyle: StyleConfig;
  colorPalette: string[];
  totalImages: number;
}

interface PlannedScene {
  sceneId: string;
  imagePrompt: string;
  enhancedPrompt: string;
  motionType: 'pan_left' | 'pan_right' | 'zoom_in' | 'zoom_out' | 'static';
  transitionIn: 'fade' | 'cut' | 'slide';
}

async function planVisuals(ctx: PipelineContext): Promise<VisualPlan> {
  const scenes = ctx.artifacts.script.scenes;
  
  // Use LLM to enhance and coordinate visual prompts
  const enhanced = await enhanceVisualPrompts(scenes, ctx.project.nichePreset);
  
  return {
    scenes: enhanced,
    globalStyle: determineStyle(ctx.project.nichePreset),
    colorPalette: extractColorPalette(enhanced),
    totalImages: scenes.length,
  };
}
```

---

## 7. Storage & Caching

### Upload to Storage
```typescript
async function uploadImage(
  imageData: Buffer,
  jobId: string,
  sceneId: string
): Promise<string> {
  const path = `jobs/${jobId}/images/${sceneId}.png`;
  
  const { error } = await supabase.storage
    .from('generated-assets')
    .upload(path, imageData, {
      contentType: 'image/png',
      cacheControl: '31536000', // 1 year
    });

  if (error) throw error;

  return supabase.storage
    .from('generated-assets')
    .getPublicUrl(path).data.publicUrl;
}
```

### Prompt-Based Caching
```typescript
function getImageCacheKey(prompt: string, style: StyleConfig): string {
  return crypto.createHash('sha256')
    .update(JSON.stringify({ prompt, style }))
    .digest('hex')
    .slice(0, 16);
}

async function getCachedImage(cacheKey: string): Promise<string | null> {
  const { data } = await supabase
    .from('image_cache')
    .select('url')
    .eq('cache_key', cacheKey)
    .single();
  
  return data?.url || null;
}
```

---

## 8. Error Handling

| Error | Cause | Recovery |
|-------|-------|----------|
| Rate limited | Too many requests | Exponential backoff |
| Safety filter | Content blocked | Rephrase prompt, retry |
| Timeout | API latency | Retry with longer timeout |
| Invalid prompt | Prompt too long/short | Truncate/expand |

### Retry Logic
```typescript
async function generateWithRetry(
  prompt: string,
  maxAttempts = 3
): Promise<GeneratedImageData> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await generateImage(prompt);
    } catch (error) {
      if (error.code === 'SAFETY_FILTER') {
        prompt = sanitizePrompt(prompt);
      } else if (error.code === 'RATE_LIMITED') {
        await sleep(Math.pow(2, attempt) * 1000);
      } else if (attempt === maxAttempts) {
        throw error;
      }
    }
  }
}
```

---

## 9. Quality Validation

```typescript
interface ImageQuality {
  isValid: boolean;
  issues: string[];
}

async function validateImage(imagePath: string): Promise<ImageQuality> {
  const issues: string[] = [];
  
  // Check dimensions
  const { width, height } = await getImageDimensions(imagePath);
  if (width < 512 || height < 512) {
    issues.push('Image too small');
  }
  
  // Check file size
  const stats = await fs.stat(imagePath);
  if (stats.size < 10000) {
    issues.push('File too small, may be corrupted');
  }
  
  // Check for mostly blank image
  const blankRatio = await calculateBlankRatio(imagePath);
  if (blankRatio > 0.8) {
    issues.push('Image appears mostly blank');
  }
  
  return { isValid: issues.length === 0, issues };
}
```

---

## 10. Configuration

```typescript
const IMAGE_CONFIG = {
  provider: 'gemini',
  model: 'imagen-3.0-generate-001',
  
  // Output settings
  defaultWidth: 1024,
  defaultHeight: 1792,
  outputFormat: 'png',
  quality: 90,
  
  // Rate limiting
  maxConcurrent: 3,
  requestDelayMs: 1000,
  maxRetries: 3,
  
  // Caching
  cacheEnabled: true,
  cacheTTLDays: 30,
};
```

---

## 11. Metrics

| Metric | Description |
|--------|-------------|
| `image_gen_duration_ms` | Time per image |
| `image_gen_batch_size` | Images per job |
| `image_gen_retry_count` | Retries needed |
| `image_gen_cache_hit_rate` | Cache effectiveness |
| `image_gen_safety_blocks` | Blocked prompts |

---

## 12. Files

| File | Purpose |
|------|---------|
| `apps/worker/src/pipeline/steps/generate-images.ts` | Main image generation |
| `apps/worker/src/pipeline/steps/plan-visuals.ts` | Visual planning |
| `apps/worker/src/pipeline/steps/visuals.ts` | Prompt enhancement |
| `apps/worker/src/lib/gemini.ts` | Gemini API client |

---

## 13. System Integration

### Communicates With

| Subsystem | Direction | Mechanism | Purpose |
|-----------|-----------|-----------|---------|
| **Pipeline** | Pipeline → Image | Function call | Trigger generation |
| **Script** | Script → Image | Context artifacts | Scene prompts |
| **Alignment** | Alignment → Image | Context artifacts | Scene durations |
| **Render** | Image → Render | Context artifacts | Image file paths |
| **Packaging** | Image → Packaging | Context artifacts | Image files |
| **Storage** | Image → Storage | Supabase client | Upload images |
| **Gemini** | Image → External | HTTP API | Image generation |

### Inbound Interfaces

```typescript
// From Script (via ctx.artifacts)
const scenes = ctx.artifacts.script.scenes;
// Each scene has: { sceneId, imagePrompt, caption }

// From Alignment (for duration-based planning)
const segments = ctx.artifacts.whisperSegments;

// Pipeline calls image generation
const result = await generateImages(ctx);
```

### Outbound Interfaces

```typescript
// To Render subsystem (via ctx.artifacts)
ctx.artifacts.imagePaths = [
  '/jobs/xxx/images/scene_001.png',
  '/jobs/xxx/images/scene_002.png',
  // ...
];

// To Storage
await supabase.storage
  .from('generated-assets')
  .upload(`jobs/${jobId}/images/scene_001.png`, imageBuffer);

// To External Gemini API
const response = await fetch(
  `${GEMINI_ENDPOINT}/models/imagen-3.0:generateImages`,
  {
    method: 'POST',
    headers: { 'x-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify({ prompt, numberOfImages: 1 })
  }
);
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      IMAGE SUBSYSTEM                             │
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │   Script     │────►│   Enhance    │────►│   Gemini     │    │
│  │ (scene[].    │     │   Prompts    │     │   Imagen     │    │
│  │  imagePrompt)│     │              │     │              │    │
│  └──────────────┘     └──────────────┘     └──────┬───────┘    │
│                                                    │            │
│                                                    ▼            │
│                                            ┌──────────────┐    │
│                                            │   Upload to  │    │
│                                            │   Storage    │    │
│                                            └──────┬───────┘    │
│                                                    │            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    ctx.artifacts                          │  │
│  │  imagePaths: ['/jobs/xxx/images/scene_001.png', ...]     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
       ┌───────────┐                   ┌───────────┐
       │  RENDER   │                   │ PACKAGING │
       │ (visual   │                   │ (include  │
       │ scenes)   │                   │ in ZIP)   │
       └───────────┘                   └───────────┘
```
