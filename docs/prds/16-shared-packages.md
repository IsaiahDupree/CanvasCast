# PRD: Shared Packages & Types

**Subsystem:** Shared  
**Version:** 1.0  
**Status:** Implemented  
**Owner:** Isaiah  

---

## 1. Overview

The Shared Packages subsystem provides common TypeScript types, utilities, and validation schemas used across the monorepo. It ensures type safety and code consistency between frontend, API, and worker packages.

### Business Goal
Reduce code duplication, ensure type safety, and maintain consistency across the entire codebase.

---

## 2. User Stories

### US-1: Type Safety
**As a** developer  
**I want** shared types across packages  
**So that** I avoid type mismatches

### US-2: Validation Reuse
**As a** developer  
**I want** shared validation schemas  
**So that** frontend and backend validate identically

### US-3: Utility Functions
**As a** developer  
**I want** common utilities in one place  
**So that** I don't duplicate code

---

## 3. Package Structure

```
packages/
├── shared/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts           # Main export
│       ├── types/
│       │   ├── database.ts    # Supabase types
│       │   ├── api.ts         # API contracts
│       │   ├── pipeline.ts    # Pipeline types
│       │   └── common.ts      # Common types
│       ├── schemas/
│       │   ├── project.ts     # Project validation
│       │   ├── job.ts         # Job validation
│       │   └── draft.ts       # Draft validation
│       ├── utils/
│       │   ├── format.ts      # Formatters
│       │   ├── validation.ts  # Validators
│       │   └── constants.ts   # Constants
│       └── errors/
│           └── index.ts       # Error classes
│
└── remotion/
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts
        ├── VideoComposition.tsx
        └── components/
            ├── Scene.tsx
            └── Caption.tsx
```

---

## 4. Core Types

### Database Types
```typescript
// packages/shared/src/types/database.ts

export type JobStatus = 
  | 'PENDING' 
  | 'QUEUED' 
  | 'SCRIPTING' 
  | 'VOICE_GEN' 
  | 'ALIGNMENT'
  | 'VISUAL_PLAN' 
  | 'IMAGE_GEN' 
  | 'TIMELINE' 
  | 'RENDERING' 
  | 'PACKAGING' 
  | 'READY' 
  | 'FAILED';

export type NichePreset = 
  | 'motivation' 
  | 'explainer' 
  | 'facts' 
  | 'history' 
  | 'finance' 
  | 'science';

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  notification_prefs: NotificationPrefs;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  title: string;
  prompt_text: string;
  niche_preset: NichePreset;
  target_minutes: number;
  voice_profile_id: string | null;
  transcript_mode: 'auto' | 'manual';
  transcript_text: string | null;
  settings: ProjectSettings;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  project_id: string;
  user_id: string;
  status: JobStatus;
  progress: number;
  status_message: string | null;
  cost_credits_reserved: number;
  cost_credits_final: number | null;
  failed_step: string | null;
  error_code: string | null;
  error_message: string | null;
  output_url: string | null;
  manifest_json: AssetManifest | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface DraftPrompt {
  id: string;
  session_token: string;
  user_id: string | null;
  prompt_text: string;
  template_id: string | null;
  options: DraftOptions;
  created_at: string;
  updated_at: string;
  expires_at: string;
}
```

### API Types
```typescript
// packages/shared/src/types/api.ts

// Request types
export interface CreateProjectRequest {
  title: string;
  promptText: string;
  nichePreset: NichePreset;
  targetMinutes: number;
  voiceProfileId?: string;
  transcriptMode?: 'auto' | 'manual';
  transcriptText?: string;
}

export interface CreateDraftRequest {
  promptText: string;
  templateId?: string;
  options?: DraftOptions;
}

// Response types
export interface CreateProjectResponse {
  projectId: string;
  jobId: string;
}

export interface JobStatusResponse {
  job: Job;
  steps: JobStep[];
}

export interface CreditBalanceResponse {
  balance: number;
  reserved: number;
  available: number;
}

// Error response
export interface ApiError {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}
```

### Pipeline Types
```typescript
// packages/shared/src/types/pipeline.ts

export interface PipelineContext {
  job: Job;
  project: Project;
  userId: string;
  projectId: string;
  jobId: string;
  basePath: string;
  outputPath: string;
  artifacts: PipelineArtifacts;
}

export interface PipelineArtifacts {
  mergedInputText?: string;
  script?: ScriptData;
  narrationPath?: string;
  narrationDurationMs?: number;
  whisperSegments?: WordSegment[];
  captionsSrtPath?: string;
  captionsVttPath?: string;
  visualPlan?: VisualPlan;
  imagePaths?: string[];
  timeline?: TimelineData;
  timelinePath?: string;
  videoPath?: string;
  zipPath?: string;
  assetUrls?: AssetUrls;
  manifest?: AssetManifest;
}

export interface ScriptData {
  title: string;
  description: string;
  narrationText: string;
  scenes: Scene[];
  metadata: ScriptMetadata;
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
```

---

## 5. Validation Schemas (Zod)

### Project Schema
```typescript
// packages/shared/src/schemas/project.ts
import { z } from 'zod';

export const NichePresetSchema = z.enum([
  'motivation',
  'explainer', 
  'facts',
  'history',
  'finance',
  'science',
]);

export const CreateProjectSchema = z.object({
  title: z.string().min(1).max(200),
  promptText: z.string().min(10).max(10000),
  nichePreset: NichePresetSchema,
  targetMinutes: z.number().int().min(1).max(10),
  voiceProfileId: z.string().uuid().optional(),
  transcriptMode: z.enum(['auto', 'manual']).default('auto'),
  transcriptText: z.string().max(50000).optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
```

### Draft Schema
```typescript
// packages/shared/src/schemas/draft.ts
import { z } from 'zod';

export const DraftSchema = z.object({
  promptText: z.string().min(1).max(10000),
  templateId: z.string().optional(),
  options: z.object({
    nichePreset: NichePresetSchema.optional(),
    targetMinutes: z.number().int().min(1).max(10).optional(),
  }).optional(),
});

export type DraftInput = z.infer<typeof DraftSchema>;
```

### Job Schema
```typescript
// packages/shared/src/schemas/job.ts
import { z } from 'zod';

export const JobStatusSchema = z.enum([
  'PENDING',
  'QUEUED',
  'SCRIPTING',
  'VOICE_GEN',
  'ALIGNMENT',
  'VISUAL_PLAN',
  'IMAGE_GEN',
  'TIMELINE',
  'RENDERING',
  'PACKAGING',
  'READY',
  'FAILED',
]);

export const JobUpdateSchema = z.object({
  status: JobStatusSchema.optional(),
  progress: z.number().int().min(0).max(100).optional(),
  statusMessage: z.string().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
});
```

---

## 6. Utility Functions

### Formatters
```typescript
// packages/shared/src/utils/format.ts

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes === 0) {
    return `${seconds}s`;
  }
  
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function formatCredits(credits: number): string {
  return `${credits} credit${credits !== 1 ? 's' : ''}`;
}

export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let size = bytes;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}
```

### Validators
```typescript
// packages/shared/src/utils/validation.ts

export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 100);
}

export function estimateCredits(targetMinutes: number, niche: NichePreset): number {
  const multiplier = ['history', 'documentary'].includes(niche) ? 1.5 : 1;
  return Math.ceil(targetMinutes * multiplier);
}
```

### Constants
```typescript
// packages/shared/src/utils/constants.ts

export const JOB_STEPS = [
  { key: 'SCRIPTING', label: 'Writing Script', order: 1 },
  { key: 'VOICE_GEN', label: 'Generating Voice', order: 2 },
  { key: 'ALIGNMENT', label: 'Syncing Audio', order: 3 },
  { key: 'VISUAL_PLAN', label: 'Planning Visuals', order: 4 },
  { key: 'IMAGE_GEN', label: 'Creating Images', order: 5 },
  { key: 'TIMELINE', label: 'Building Timeline', order: 6 },
  { key: 'RENDERING', label: 'Rendering Video', order: 7 },
  { key: 'PACKAGING', label: 'Packaging Assets', order: 8 },
] as const;

export const NICHE_CONFIG: Record<NichePreset, NicheSettings> = {
  motivation: {
    label: 'Motivation',
    description: 'Inspiring and uplifting content',
    voiceStyle: 'energetic',
    visualStyle: 'cinematic',
    creditMultiplier: 1,
  },
  explainer: {
    label: 'Explainer',
    description: 'Educational and informative',
    voiceStyle: 'clear',
    visualStyle: 'minimal',
    creditMultiplier: 1,
  },
  facts: {
    label: 'Amazing Facts',
    description: 'Surprising and engaging facts',
    voiceStyle: 'enthusiastic',
    visualStyle: 'vibrant',
    creditMultiplier: 1,
  },
  history: {
    label: 'History',
    description: 'Historical stories and events',
    voiceStyle: 'authoritative',
    visualStyle: 'documentary',
    creditMultiplier: 1.5,
  },
  finance: {
    label: 'Finance',
    description: 'Financial tips and education',
    voiceStyle: 'professional',
    visualStyle: 'clean',
    creditMultiplier: 1,
  },
  science: {
    label: 'Science',
    description: 'Scientific explanations',
    voiceStyle: 'curious',
    visualStyle: 'diagram',
    creditMultiplier: 1,
  },
};

export const MAX_TARGET_MINUTES = 10;
export const MIN_TARGET_MINUTES = 1;
export const TRIAL_CREDITS = 10;
export const DRAFT_EXPIRY_DAYS = 7;
```

---

## 7. Error Classes

```typescript
// packages/shared/src/errors/index.ts

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
  
  toJSON() {
    return {
      error: this.message,
      code: this.code,
      details: this.details,
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'AUTH_ERROR', 401);
    this.name = 'AuthError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class InsufficientCreditsError extends AppError {
  constructor(required: number, available: number) {
    super(
      `Insufficient credits: ${required} required, ${available} available`,
      'INSUFFICIENT_CREDITS',
      402,
      { required, available }
    );
    this.name = 'InsufficientCreditsError';
  }
}

export class PipelineError extends AppError {
  constructor(step: string, message: string) {
    super(message, `PIPELINE_${step.toUpperCase()}_ERROR`, 500, { step });
    this.name = 'PipelineError';
  }
}
```

---

## 8. Package Configuration

### package.json
```json
{
  "name": "@canvascast/shared",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./types": "./dist/types/index.js",
    "./schemas": "./dist/schemas/index.js",
    "./utils": "./dist/utils/index.js",
    "./errors": "./dist/errors/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 9. Usage Examples

### In Frontend
```typescript
// apps/web/src/app/app/new/page.tsx
import { CreateProjectSchema, NichePresetSchema } from '@canvascast/shared/schemas';
import { NICHE_CONFIG, estimateCredits } from '@canvascast/shared/utils';
import type { CreateProjectRequest } from '@canvascast/shared/types';

export default function NewProjectPage() {
  const handleSubmit = (data: CreateProjectRequest) => {
    const parsed = CreateProjectSchema.safeParse(data);
    if (!parsed.success) {
      // Handle validation error
    }
    
    const credits = estimateCredits(data.targetMinutes, data.nichePreset);
    // ...
  };
}
```

### In API
```typescript
// apps/api/src/routes/projects.ts
import { CreateProjectSchema } from '@canvascast/shared/schemas';
import { ValidationError } from '@canvascast/shared/errors';
import type { Job, Project } from '@canvascast/shared/types';

app.post('/projects', async (req, res) => {
  const parsed = CreateProjectSchema.safeParse(req.body);
  
  if (!parsed.success) {
    throw new ValidationError('Invalid project data', parsed.error.flatten());
  }
  
  // Type-safe access
  const { title, promptText, nichePreset } = parsed.data;
  // ...
});
```

### In Worker
```typescript
// apps/worker/src/pipeline/runner.ts
import type { PipelineContext, PipelineArtifacts } from '@canvascast/shared/types';
import { JOB_STEPS } from '@canvascast/shared/utils';
import { PipelineError } from '@canvascast/shared/errors';

async function runPipeline(ctx: PipelineContext): Promise<void> {
  for (const step of JOB_STEPS) {
    try {
      await executeStep(step.key, ctx);
    } catch (error) {
      throw new PipelineError(step.key, error.message);
    }
  }
}
```

---

## 10. System Integration

### Communicates With

| Subsystem | Direction | Mechanism | Purpose |
|-----------|-----------|-----------|---------|
| **Frontend** | Shared → Frontend | Import | Types, schemas, utils |
| **API** | Shared → API | Import | Validation, types, errors |
| **Worker** | Shared → Worker | Import | Pipeline types, constants |
| **All** | Shared → All | TypeScript | Type safety |

### Package Flow
```
┌─────────────────────────────────────────────────────────────────┐
│                     SHARED PACKAGES                              │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    @canvascast/shared                     │  │
│  │                                                          │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │  │
│  │  │  Types   │  │ Schemas  │  │  Utils   │  │  Errors  │ │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │  │
│  │       │             │             │             │        │  │
│  └───────┼─────────────┼─────────────┼─────────────┼────────┘  │
│          │             │             │             │           │
│          └─────────────┴─────────────┴─────────────┘           │
│                              │                                  │
│          ┌───────────────────┼───────────────────┐             │
│          ▼                   ▼                   ▼             │
│   ┌───────────┐       ┌───────────┐       ┌───────────┐       │
│   │  Frontend │       │    API    │       │  Worker   │       │
│   │   (web)   │       │           │       │           │       │
│   └───────────┘       └───────────┘       └───────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. Files

| File | Purpose |
|------|---------|
| `packages/shared/src/types/database.ts` | Database entity types |
| `packages/shared/src/types/api.ts` | API request/response types |
| `packages/shared/src/types/pipeline.ts` | Pipeline context types |
| `packages/shared/src/schemas/` | Zod validation schemas |
| `packages/shared/src/utils/` | Utility functions |
| `packages/shared/src/errors/` | Error classes |
| `packages/remotion/` | Remotion video components |
