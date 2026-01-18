# Implementation PRD: Worker Pipeline Transformation

**Type:** Implementation Guide  
**Priority:** P0  
**Status:** Ready for Implementation  

---

## 1. Overview

This document details how to transform BlankLogo's worker pipeline into CanvasCast's 9-step video generation pipeline. The worker structure is kept, but the pipeline logic is completely replaced.

---

## 2. Pipeline Comparison

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     PIPELINE TRANSFORMATION                              │
│                                                                         │
│  BlankLogo (DELETE)                 CanvasCast (CREATE)                 │
│  ─────────────────────────────────────────────────────────────────────  │
│  1. Download assets                 1. Script Generation (LLM)          │
│  2. Generate variations            2. Voice Generation (TTS)           │
│  3. Render animation               3. Alignment (Whisper)              │
│  4. Upload results                 4. Visual Planning                  │
│                                    5. Image Generation (Gemini)        │
│                                    6. Timeline Building                │
│                                    7. Video Rendering (Remotion)       │
│                                    8. Asset Packaging                  │
│                                    9. Job Completion                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. KEEP: Worker Entry Point Structure

### File: `apps/worker/src/index.ts`

```typescript
// KEEP: Basic structure, MODIFY: Queue name and handler

import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { runPipeline } from './pipeline/runner';

const redis = new Redis(process.env.REDIS_URL!);

// MODIFY: Queue name from 'logo-jobs' to 'video-jobs'
const worker = new Worker(
  'video-jobs',  // CHANGED
  async (job) => {
    console.log(`[WORKER] Processing job ${job.id}`);
    await runPipeline(job.data);
  },
  {
    connection: redis,
    concurrency: 1,
  }
);

worker.on('completed', (job) => {
  console.log(`[WORKER] Job ${job.id} completed`);
});

worker.on('failed', (job, error) => {
  console.error(`[WORKER] Job ${job?.id} failed:`, error);
});

console.log('[WORKER] Started, waiting for jobs...');
```

---

## 4. DELETE: Old Pipeline Files

```bash
# DELETE these BlankLogo files entirely
rm -rf apps/worker/src/pipeline/
rm apps/worker/src/runpod-client.ts  # Not needed
```

---

## 5. CREATE: New Pipeline Structure

### Directory Structure
```
apps/worker/src/
├── index.ts                    # MODIFY (queue name)
├── pipeline/
│   ├── runner.ts               # NEW: Main orchestrator
│   ├── context.ts              # NEW: Pipeline context type
│   └── steps/
│       ├── generate-script.ts  # NEW: Step 1
│       ├── generate-voice.ts   # NEW: Step 2
│       ├── run-alignment.ts    # NEW: Step 3
│       ├── plan-visuals.ts     # NEW: Step 4
│       ├── generate-images.ts  # NEW: Step 5
│       ├── build-timeline.ts   # NEW: Step 6
│       ├── render-video.ts     # NEW: Step 7
│       ├── package-assets.ts   # NEW: Step 8
│       └── complete-job.ts     # NEW: Step 9
├── lib/
│   ├── supabase.ts             # KEEP
│   ├── redis.ts                # KEEP
│   ├── openai.ts               # NEW: OpenAI client
│   ├── gemini.ts               # NEW: Gemini client
│   ├── remotion.ts             # NEW: Remotion renderer
│   ├── storage.ts              # NEW: Storage helpers
│   └── captions.ts             # NEW: SRT/VTT generation
├── notify.ts                   # KEEP
└── cleanup.ts                  # KEEP (modify paths)
```

---

## 6. CREATE: Pipeline Context

### File: `apps/worker/src/pipeline/context.ts`

```typescript
// NEW FILE
import type { Job, Project } from '@canvascast/shared/types';

export interface PipelineContext {
  // Job info
  job: Job;
  project: Project;
  jobId: string;
  projectId: string;
  userId: string;
  
  // Paths
  basePath: string;      // /tmp/jobs/{jobId}
  outputPath: string;    // /tmp/jobs/{jobId}/output
  
  // Accumulated artifacts from each step
  artifacts: PipelineArtifacts;
}

export interface PipelineArtifacts {
  // Step 1: Script
  script?: {
    title: string;
    description: string;
    narrationText: string;
    scenes: Scene[];
    metadata: ScriptMetadata;
  };
  
  // Step 2: Voice
  narrationPath?: string;
  narrationDurationMs?: number;
  
  // Step 3: Alignment
  whisperSegments?: WordSegment[];
  captionsSrtPath?: string;
  captionsVttPath?: string;
  
  // Step 4: Visual Plan
  visualPlan?: VisualPlan;
  
  // Step 5: Images
  imagePaths?: string[];
  
  // Step 6: Timeline
  timeline?: TimelineData;
  timelinePath?: string;
  
  // Step 7: Render
  videoPath?: string;
  
  // Step 8: Packaging
  zipPath?: string;
  assetUrls?: AssetUrls;
  manifest?: AssetManifest;
}

export interface Scene {
  sceneId: string;
  caption: string;
  imagePrompt: string;
  enhancedImagePrompt?: string;
  durationHint: number;
}

export interface WordSegment {
  word: string;
  start: number;
  end: number;
}

export interface StepResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
```

---

## 7. CREATE: Pipeline Runner

### File: `apps/worker/src/pipeline/runner.ts`

```typescript
// NEW FILE
import { supabase } from '../lib/supabase';
import { PipelineContext, StepResult } from './context';

// Import all steps
import { generateScript } from './steps/generate-script';
import { generateVoice } from './steps/generate-voice';
import { runAlignment } from './steps/run-alignment';
import { planVisuals } from './steps/plan-visuals';
import { generateImages } from './steps/generate-images';
import { buildTimeline } from './steps/build-timeline';
import { renderVideo } from './steps/render-video';
import { packageAssets } from './steps/package-assets';
import { completeJob } from './steps/complete-job';

interface JobPayload {
  jobId: string;
  projectId: string;
  userId: string;
  title: string;
  nichePreset: string;
  targetMinutes: number;
  content: string;
  voiceProfileId?: string;
}

const STEPS = [
  { name: 'SCRIPTING', fn: generateScript, order: 1 },
  { name: 'VOICE_GEN', fn: generateVoice, order: 2 },
  { name: 'ALIGNMENT', fn: runAlignment, order: 3 },
  { name: 'VISUAL_PLAN', fn: planVisuals, order: 4 },
  { name: 'IMAGE_GEN', fn: generateImages, order: 5 },
  { name: 'TIMELINE', fn: buildTimeline, order: 6 },
  { name: 'RENDERING', fn: renderVideo, order: 7 },
  { name: 'PACKAGING', fn: packageAssets, order: 8 },
] as const;

export async function runPipeline(payload: JobPayload): Promise<void> {
  const { jobId, projectId, userId } = payload;
  
  console.log(`[PIPELINE] Starting job ${jobId}`);
  
  // Load project data
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();
  
  const { data: job } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single();
  
  // Initialize context
  const ctx: PipelineContext = {
    job,
    project,
    jobId,
    projectId,
    userId,
    basePath: `/tmp/jobs/${jobId}`,
    outputPath: `/tmp/jobs/${jobId}/output`,
    artifacts: {},
  };
  
  // Create working directories
  await fs.mkdir(ctx.basePath, { recursive: true });
  await fs.mkdir(ctx.outputPath, { recursive: true });
  
  // Initialize job steps in DB
  await initializeJobSteps(jobId);
  
  try {
    // Execute each step
    for (const step of STEPS) {
      console.log(`[PIPELINE] Running step: ${step.name}`);
      
      // Update job status
      await updateJobStatus(jobId, step.name);
      await updateStepStatus(jobId, step.name, 'started');
      
      // Run step
      const result = await step.fn(ctx);
      
      if (!result.success) {
        console.error(`[PIPELINE] Step ${step.name} failed:`, result.error);
        await failJob(jobId, step.name, result.error!);
        return;
      }
      
      // Mark step complete
      await updateStepStatus(jobId, step.name, 'succeeded');
      console.log(`[PIPELINE] Step ${step.name} completed`);
    }
    
    // Final completion step
    await completeJob(ctx);
    
    console.log(`[PIPELINE] Job ${jobId} completed successfully`);
    
  } catch (error) {
    console.error(`[PIPELINE] Unexpected error:`, error);
    await failJob(jobId, 'UNKNOWN', {
      code: 'PIPELINE_ERROR',
      message: error.message,
    });
  } finally {
    // Cleanup temp files
    await cleanup(ctx.basePath);
  }
}

async function initializeJobSteps(jobId: string): Promise<void> {
  const steps = STEPS.map((step) => ({
    job_id: jobId,
    step_name: step.name,
    step_order: step.order,
    state: 'pending',
  }));
  
  await supabase.from('job_steps').insert(steps);
}

async function updateJobStatus(jobId: string, status: string): Promise<void> {
  const progress = Math.round((STEPS.findIndex(s => s.name === status) / STEPS.length) * 100);
  
  await supabase
    .from('jobs')
    .update({ status, progress })
    .eq('id', jobId);
}

async function updateStepStatus(
  jobId: string, 
  stepName: string, 
  state: 'started' | 'succeeded' | 'failed'
): Promise<void> {
  const updates: Record<string, unknown> = { state };
  
  if (state === 'started') {
    updates.started_at = new Date().toISOString();
  } else {
    updates.finished_at = new Date().toISOString();
  }
  
  await supabase
    .from('job_steps')
    .update(updates)
    .eq('job_id', jobId)
    .eq('step_name', stepName);
}

async function failJob(
  jobId: string, 
  failedStep: string, 
  error: { code: string; message: string }
): Promise<void> {
  await supabase
    .from('jobs')
    .update({
      status: 'FAILED',
      failed_step: failedStep,
      error_code: error.code,
      error_message: error.message,
      finished_at: new Date().toISOString(),
    })
    .eq('id', jobId);
  
  // Release reserved credits
  await supabase.rpc('release_job_credits', { p_job_id: jobId });
  
  // Notify user
  await notifyJobFailed(jobId, error);
}

async function cleanup(path: string): Promise<void> {
  try {
    await fs.rm(path, { recursive: true, force: true });
  } catch (e) {
    console.warn(`[CLEANUP] Failed to remove ${path}:`, e);
  }
}
```

---

## 8. CREATE: Step 1 - Script Generation

### File: `apps/worker/src/pipeline/steps/generate-script.ts`

```typescript
// NEW FILE
import OpenAI from 'openai';
import { PipelineContext, StepResult } from '../context';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateScript(ctx: PipelineContext): Promise<StepResult> {
  try {
    const { project } = ctx;
    
    const systemPrompt = getSystemPrompt(project.niche_preset);
    const userPrompt = buildUserPrompt(project);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });
    
    const content = response.choices[0].message.content;
    const script = JSON.parse(content!);
    
    // Validate script structure
    if (!script.narrationText || !script.scenes?.length) {
      throw new Error('Invalid script structure');
    }
    
    // Store in context
    ctx.artifacts.script = {
      title: script.title || project.title,
      description: script.description || '',
      narrationText: script.narrationText,
      scenes: script.scenes,
      metadata: {
        wordCount: script.narrationText.split(/\s+/).length,
        estimatedDuration: estimateDuration(script.narrationText),
        sceneCount: script.scenes.length,
      },
    };
    
    return { success: true, data: { script: ctx.artifacts.script } };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'SCRIPT_GENERATION_ERROR',
        message: error.message,
      },
    };
  }
}

function getSystemPrompt(niche: string): string {
  const nichePrompts: Record<string, string> = {
    motivation: 'You are an expert motivational content writer...',
    explainer: 'You are an expert at explaining complex topics simply...',
    facts: 'You are an engaging presenter of surprising facts...',
    history: 'You are a compelling historical storyteller...',
    finance: 'You are a clear financial educator...',
    science: 'You are an enthusiastic science communicator...',
  };
  
  return `${nichePrompts[niche] || nichePrompts.explainer}
  
Create a video script in JSON format with:
- title: string
- description: string (YouTube description)
- narrationText: string (full narration, no timestamps)
- scenes: array of { sceneId, caption, imagePrompt, durationHint }

Each scene should be 5-15 seconds. Image prompts should be detailed and visual.`;
}

function buildUserPrompt(project: Project): string {
  return `Create a ${project.target_minutes}-minute video about:

${project.prompt_text}

Requirements:
- Natural, conversational narration
- ${Math.ceil(project.target_minutes * 4)} to ${Math.ceil(project.target_minutes * 6)} scenes
- Engaging opening hook
- Clear conclusion`;
}

function estimateDuration(text: string): number {
  const words = text.split(/\s+/).length;
  const wpm = 150; // Average speaking rate
  return Math.round((words / wpm) * 60 * 1000); // ms
}
```

---

## 9. CREATE: Step 2 - Voice Generation

### File: `apps/worker/src/pipeline/steps/generate-voice.ts`

```typescript
// NEW FILE
import OpenAI from 'openai';
import * as fs from 'fs/promises';
import { PipelineContext, StepResult } from '../context';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateVoice(ctx: PipelineContext): Promise<StepResult> {
  try {
    const narrationText = ctx.artifacts.script!.narrationText;
    const outputPath = `${ctx.basePath}/narration.mp3`;
    
    // Generate with OpenAI TTS
    const response = await openai.audio.speech.create({
      model: 'tts-1-hd',
      voice: getVoiceForNiche(ctx.project.niche_preset),
      input: narrationText,
      response_format: 'mp3',
    });
    
    // Save to file
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(outputPath, buffer);
    
    // Get duration
    const duration = await getAudioDuration(outputPath);
    
    ctx.artifacts.narrationPath = outputPath;
    ctx.artifacts.narrationDurationMs = duration;
    
    return { 
      success: true, 
      data: { path: outputPath, durationMs: duration } 
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'VOICE_GENERATION_ERROR',
        message: error.message,
      },
    };
  }
}

function getVoiceForNiche(niche: string): string {
  const voices: Record<string, string> = {
    motivation: 'onyx',    // Deep, inspiring
    explainer: 'alloy',    // Clear, neutral
    facts: 'nova',         // Energetic
    history: 'fable',      // Storytelling
    finance: 'echo',       // Professional
    science: 'shimmer',    // Curious
  };
  return voices[niche] || 'alloy';
}

async function getAudioDuration(path: string): Promise<number> {
  // Use ffprobe to get duration
  const { execSync } = require('child_process');
  const result = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${path}"`
  );
  return Math.round(parseFloat(result.toString()) * 1000);
}
```

---

## 10. CREATE: Step 3 - Alignment

### File: `apps/worker/src/pipeline/steps/run-alignment.ts`

```typescript
// NEW FILE
import OpenAI from 'openai';
import * as fs from 'fs/promises';
import { PipelineContext, StepResult } from '../context';
import { generateSRT, generateVTT } from '../../lib/captions';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function runAlignment(ctx: PipelineContext): Promise<StepResult> {
  try {
    const audioPath = ctx.artifacts.narrationPath!;
    
    // Transcribe with Whisper
    const audioFile = await fs.readFile(audioPath);
    const transcription = await openai.audio.transcriptions.create({
      file: new File([audioFile], 'narration.mp3', { type: 'audio/mpeg' }),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
    });
    
    // Extract word segments
    const segments = transcription.words?.map((w) => ({
      word: w.word,
      start: w.start,
      end: w.end,
    })) || [];
    
    // Generate caption files
    const srtPath = `${ctx.basePath}/captions.srt`;
    const vttPath = `${ctx.basePath}/captions.vtt`;
    
    await fs.writeFile(srtPath, generateSRT(segments));
    await fs.writeFile(vttPath, generateVTT(segments));
    
    ctx.artifacts.whisperSegments = segments;
    ctx.artifacts.captionsSrtPath = srtPath;
    ctx.artifacts.captionsVttPath = vttPath;
    
    return { 
      success: true, 
      data: { wordCount: segments.length } 
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'ALIGNMENT_ERROR',
        message: error.message,
      },
    };
  }
}
```

---

## 11. CREATE: Steps 4-9 (Abbreviated)

### File: `apps/worker/src/pipeline/steps/plan-visuals.ts`
```typescript
// Analyze script scenes and plan visual transitions
export async function planVisuals(ctx: PipelineContext): Promise<StepResult> {
  // Enhance image prompts with style consistency
  // Calculate scene timings based on word segments
  // Return visual plan
}
```

### File: `apps/worker/src/pipeline/steps/generate-images.ts`
```typescript
// Generate images using Gemini Imagen
export async function generateImages(ctx: PipelineContext): Promise<StepResult> {
  // For each scene, generate image with Gemini
  // Apply retry logic and rate limiting
  // Save images to basePath
  // Store paths in ctx.artifacts.imagePaths
}
```

### File: `apps/worker/src/pipeline/steps/build-timeline.ts`
```typescript
// Build Remotion timeline data
export async function buildTimeline(ctx: PipelineContext): Promise<StepResult> {
  // Combine audio, images, and word segments
  // Create Remotion-compatible timeline JSON
  // Store in ctx.artifacts.timeline
}
```

### File: `apps/worker/src/pipeline/steps/render-video.ts`
```typescript
// Render video with Remotion
export async function renderVideo(ctx: PipelineContext): Promise<StepResult> {
  // Call Remotion CLI or Modal function
  // Render to MP4
  // Store path in ctx.artifacts.videoPath
}
```

### File: `apps/worker/src/pipeline/steps/package-assets.ts`
```typescript
// Package and upload all assets
export async function packageAssets(ctx: PipelineContext): Promise<StepResult> {
  // Upload video, audio, images to Supabase Storage
  // Create ZIP bundle
  // Generate manifest.json
  // Store URLs in ctx.artifacts
}
```

### File: `apps/worker/src/pipeline/steps/complete-job.ts`
```typescript
// Finalize job
export async function completeJob(ctx: PipelineContext): Promise<StepResult> {
  // Update job status to READY
  // Finalize credits
  // Send notification email
  // Call API completion endpoint
}
```

---

## 12. CREATE: Library Files

### File: `apps/worker/src/lib/openai.ts`
```typescript
import OpenAI from 'openai';
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
```

### File: `apps/worker/src/lib/gemini.ts`
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
```

### File: `apps/worker/src/lib/captions.ts`
```typescript
export function generateSRT(segments: WordSegment[]): string {
  // Convert word segments to SRT format
}

export function generateVTT(segments: WordSegment[]): string {
  // Convert word segments to VTT format
}
```

### File: `apps/worker/src/lib/storage.ts`
```typescript
import { supabase } from './supabase';

export async function uploadToStorage(
  bucket: string,
  path: string,
  file: Buffer
): Promise<string> {
  await supabase.storage.from(bucket).upload(path, file);
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
```

---

## 13. Dependencies to Add

### `apps/worker/package.json`
```json
{
  "dependencies": {
    "openai": "^4.28.0",
    "@google/generative-ai": "^0.2.0",
    "@remotion/renderer": "^4.0.0",
    "@remotion/cli": "^4.0.0",
    "fluent-ffmpeg": "^2.1.2",
    "archiver": "^6.0.1"
  }
}
```
