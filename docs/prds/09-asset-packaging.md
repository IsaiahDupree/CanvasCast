# PRD: Asset Packaging & Delivery

**Subsystem:** Packaging  
**Version:** 1.0  
**Status:** Implemented  
**Owner:** Isaiah  

---

## 1. Overview

The Asset Packaging subsystem bundles all generated assets (video, audio, images, captions, metadata) into a downloadable package. It uploads files to cloud storage, generates manifest files, and creates ZIP archives for easy download.

### Business Goal
Deliver complete, well-organized asset packages that users can immediately use for publishing or further editing.

---

## 2. User Stories

### US-1: Download All Assets
**As a** user  
**I want to** download all my video assets in one click  
**So that** I have everything I need locally

### US-2: Individual Downloads
**As a** user  
**I want to** download specific files (just video, just captions)  
**So that** I don't have to download everything

### US-3: Asset Manifest
**As a** user  
**I want** a manifest file describing all assets  
**So that** I can programmatically access my content

---

## 3. Asset Bundle Structure

```
job_12345/
├── video.mp4              # Final rendered video
├── audio.mp3              # Narration audio
├── audio.wav              # High-quality audio
├── captions.srt           # Captions (SubRip format)
├── captions.vtt           # Captions (WebVTT format)
├── script.json            # Generated script
├── scene_plan.json        # Visual plan
├── timeline.json          # Remotion timeline
├── manifest.json          # Asset manifest
├── images/
│   ├── scene_001.png
│   ├── scene_002.png
│   └── ...
└── thumbnails/
    ├── thumb_1080.jpg     # Full-size thumbnail
    ├── thumb_540.jpg      # Medium thumbnail
    └── thumb_270.jpg      # Small thumbnail
```

---

## 4. Input/Output

### Input
```typescript
interface PackagingInput {
  jobId: string;
  userId: string;
  projectId: string;
  artifacts: {
    videoPath: string;
    audioPath: string;
    captionsSrtPath: string;
    captionsVttPath?: string;
    imagePaths: string[];
    scriptPath: string;
    timelinePath: string;
  };
  options: {
    generateThumbnails: boolean;
    includeSourceFiles: boolean;
    compressionLevel: 'fast' | 'balanced' | 'max';
  };
}
```

### Output
```typescript
interface PackagingOutput {
  manifest: AssetManifest;
  zipPath: string;
  zipUrl: string;
  assets: UploadedAsset[];
  totalSizeBytes: number;
}

interface UploadedAsset {
  type: AssetType;
  localPath: string;
  storagePath: string;
  publicUrl: string;
  sizeBytes: number;
  mimeType: string;
  metadata: Record<string, any>;
}
```

---

## 5. Manifest Schema

```typescript
interface AssetManifest {
  version: '1.0';
  jobId: string;
  projectId: string;
  createdAt: string;
  
  video: {
    url: string;
    duration: number;
    width: number;
    height: number;
    fps: number;
    codec: string;
    size: number;
  };
  
  audio: {
    mp3Url: string;
    wavUrl?: string;
    duration: number;
    sampleRate: number;
  };
  
  captions: {
    srtUrl: string;
    vttUrl: string;
    wordCount: number;
    language: string;
  };
  
  images: Array<{
    sceneId: string;
    url: string;
    width: number;
    height: number;
  }>;
  
  thumbnails: {
    large: string;
    medium: string;
    small: string;
  };
  
  metadata: {
    title: string;
    description: string;
    niche: string;
    generatedAt: string;
  };
  
  download: {
    zipUrl: string;
    zipSize: number;
  };
}
```

---

## 6. Functional Requirements

### FR-1: Upload Assets to Storage

```typescript
async function uploadAssets(
  ctx: PipelineContext
): Promise<UploadedAsset[]> {
  const assets: UploadedAsset[] = [];
  const basePath = `users/${ctx.userId}/jobs/${ctx.jobId}`;
  
  // Upload video
  assets.push(await uploadFile(
    ctx.artifacts.videoPath,
    `${basePath}/video.mp4`,
    'video/mp4'
  ));
  
  // Upload audio
  assets.push(await uploadFile(
    ctx.artifacts.narrationPath,
    `${basePath}/audio.mp3`,
    'audio/mpeg'
  ));
  
  // Upload captions
  assets.push(await uploadFile(
    ctx.artifacts.captionsSrtPath,
    `${basePath}/captions.srt`,
    'text/plain'
  ));
  
  // Upload images
  for (let i = 0; i < ctx.artifacts.imagePaths.length; i++) {
    assets.push(await uploadFile(
      ctx.artifacts.imagePaths[i],
      `${basePath}/images/scene_${String(i + 1).padStart(3, '0')}.png`,
      'image/png'
    ));
  }
  
  return assets;
}

async function uploadFile(
  localPath: string,
  storagePath: string,
  mimeType: string
): Promise<UploadedAsset> {
  const fileBuffer = await fs.readFile(localPath);
  const stats = await fs.stat(localPath);
  
  const { error } = await supabase.storage
    .from('generated-assets')
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      cacheControl: '31536000',
      upsert: true,
    });
  
  if (error) throw error;
  
  const { data: { publicUrl } } = supabase.storage
    .from('generated-assets')
    .getPublicUrl(storagePath);
  
  return {
    type: getAssetType(mimeType),
    localPath,
    storagePath,
    publicUrl,
    sizeBytes: stats.size,
    mimeType,
    metadata: {},
  };
}
```

### FR-2: Generate Thumbnails

```typescript
async function generateThumbnails(
  videoPath: string,
  outputDir: string
): Promise<ThumbnailSet> {
  const sizes = [
    { name: 'large', width: 1080 },
    { name: 'medium', width: 540 },
    { name: 'small', width: 270 },
  ];
  
  const thumbnails: Record<string, string> = {};
  
  for (const size of sizes) {
    const outputPath = `${outputDir}/thumb_${size.width}.jpg`;
    
    await exec(`ffmpeg -i "${videoPath}" \
      -vf "thumbnail,scale=${size.width}:-1" \
      -frames:v 1 \
      -q:v 2 \
      "${outputPath}"`);
    
    thumbnails[size.name] = outputPath;
  }
  
  return thumbnails;
}
```

### FR-3: Create ZIP Archive

```typescript
async function createZipArchive(
  assets: UploadedAsset[],
  manifest: AssetManifest,
  outputPath: string
): Promise<{ path: string; size: number }> {
  const archive = archiver('zip', { zlib: { level: 6 } });
  const output = fs.createWriteStream(outputPath);
  
  archive.pipe(output);
  
  // Add all assets
  for (const asset of assets) {
    const filename = path.basename(asset.storagePath);
    archive.file(asset.localPath, { name: filename });
  }
  
  // Add manifest
  archive.append(JSON.stringify(manifest, null, 2), { 
    name: 'manifest.json' 
  });
  
  await archive.finalize();
  
  const stats = await fs.stat(outputPath);
  return { path: outputPath, size: stats.size };
}
```

### FR-4: Generate Manifest

```typescript
async function generateManifest(
  ctx: PipelineContext,
  assets: UploadedAsset[]
): Promise<AssetManifest> {
  const videoAsset = assets.find(a => a.type === 'video')!;
  const audioAsset = assets.find(a => a.type === 'audio')!;
  const captionsAsset = assets.find(a => a.type === 'captions')!;
  const imageAssets = assets.filter(a => a.type === 'image');
  
  const videoMeta = await getVideoMetadata(videoAsset.localPath);
  const audioMeta = await getAudioMetadata(audioAsset.localPath);
  
  return {
    version: '1.0',
    jobId: ctx.jobId,
    projectId: ctx.projectId,
    createdAt: new Date().toISOString(),
    
    video: {
      url: videoAsset.publicUrl,
      duration: videoMeta.duration,
      width: videoMeta.width,
      height: videoMeta.height,
      fps: videoMeta.fps,
      codec: videoMeta.codec,
      size: videoAsset.sizeBytes,
    },
    
    audio: {
      mp3Url: audioAsset.publicUrl,
      duration: audioMeta.duration,
      sampleRate: audioMeta.sampleRate,
    },
    
    captions: {
      srtUrl: captionsAsset.publicUrl,
      vttUrl: captionsAsset.publicUrl.replace('.srt', '.vtt'),
      wordCount: ctx.artifacts.whisperSegments.length,
      language: 'en',
    },
    
    images: imageAssets.map((img, i) => ({
      sceneId: `s${i + 1}`,
      url: img.publicUrl,
      width: 1024,
      height: 1792,
    })),
    
    thumbnails: ctx.artifacts.thumbnails,
    
    metadata: {
      title: ctx.project.title,
      description: ctx.artifacts.script.description,
      niche: ctx.project.nichePreset,
      generatedAt: new Date().toISOString(),
    },
    
    download: {
      zipUrl: '', // Filled after ZIP upload
      zipSize: 0,
    },
  };
}
```

### FR-5: Save Asset Records to Database

```typescript
async function saveAssetRecords(
  jobId: string,
  assets: UploadedAsset[],
  manifest: AssetManifest
): Promise<void> {
  const records = assets.map(asset => ({
    job_id: jobId,
    type: asset.type,
    url: asset.publicUrl,
    storage_path: asset.storagePath,
    size_bytes: asset.sizeBytes,
    mime_type: asset.mimeType,
    metadata_json: asset.metadata,
  }));
  
  // Add manifest record
  records.push({
    job_id: jobId,
    type: 'manifest',
    url: manifest.download.zipUrl.replace('assets.zip', 'manifest.json'),
    storage_path: `users/${manifest.projectId}/jobs/${jobId}/manifest.json`,
    size_bytes: JSON.stringify(manifest).length,
    mime_type: 'application/json',
    metadata_json: {},
  });
  
  await supabase.from('assets').insert(records);
}
```

---

## 7. Storage Configuration

### Supabase Storage Buckets

| Bucket | Purpose | Public |
|--------|---------|--------|
| `generated-assets` | Videos, images, audio | Yes |
| `voice-samples` | User voice uploads | No |
| `temp-processing` | Intermediate files | No |

### Retention Policy
- Generated assets: 90 days (configurable per plan)
- Temp files: 24 hours
- Deleted on user request

### CDN Configuration
```typescript
const STORAGE_CONFIG = {
  bucket: 'generated-assets',
  cacheControl: '31536000', // 1 year
  cdnUrl: process.env.CDN_URL || null,
  maxFileSizeMB: 500,
};
```

---

## 8. Download Endpoints

### Get Asset URLs
```
GET /api/v1/jobs/:jobId/assets
```

Response:
```json
{
  "assets": [
    { "type": "video", "url": "...", "filename": "video.mp4" },
    { "type": "audio", "url": "...", "filename": "audio.mp3" },
    { "type": "captions", "url": "...", "filename": "captions.srt" },
    { "type": "zip", "url": "...", "filename": "assets.zip" }
  ],
  "manifest": { ... }
}
```

### Generate Signed Download URL
```
POST /api/v1/assets/:assetId/download
```

Response:
```json
{
  "downloadUrl": "https://...",
  "expiresAt": "2026-01-18T..."
}
```

---

## 9. Error Handling

| Error | Cause | Recovery |
|-------|-------|----------|
| Upload failed | Storage quota | Cleanup old assets |
| ZIP creation failed | Disk space | Stream to storage |
| Missing asset | File not found | Skip with warning |
| Timeout | Large files | Increase timeout |

---

## 10. Metrics

| Metric | Description |
|--------|-------------|
| `packaging_duration_ms` | Time to package |
| `total_asset_size_mb` | Combined size |
| `zip_size_mb` | Archive size |
| `upload_throughput_mbps` | Upload speed |
| `asset_download_count` | Downloads per asset type |

---

## 11. Files

| File | Purpose |
|------|---------|
| `apps/worker/src/pipeline/steps/package-assets.ts` | Main packaging logic |
| `apps/worker/src/pipeline/steps/packaging.ts` | ZIP and manifest |
| `apps/api/src/index.ts` | Download endpoints |
| `apps/web/src/app/app/jobs/[jobId]/page.tsx` | Download UI |

---

## 12. System Integration

### Communicates With

| Subsystem | Direction | Mechanism | Purpose |
|-----------|-----------|-----------|---------|
| **Pipeline** | Pipeline → Packaging | Function call | Trigger packaging |
| **Render** | Render → Packaging | Context artifacts | Video file |
| **Voice** | Voice → Packaging | Context artifacts | Audio file |
| **Alignment** | Alignment → Packaging | Context artifacts | Caption files |
| **Image** | Image → Packaging | Context artifacts | Image files |
| **Script** | Script → Packaging | Context artifacts | Script JSON |
| **Storage** | Packaging → Storage | Supabase client | Upload assets |
| **Database** | Packaging → DB | Supabase client | Save asset records |
| **Frontend** | Frontend ← Packaging | REST API | Download URLs |

### Inbound Interfaces

```typescript
// From all pipeline steps (via ctx.artifacts)
const {
  videoPath,         // From Render
  narrationPath,     // From Voice
  captionsSrtPath,   // From Alignment
  captionsVttPath,
  imagePaths,        // From Image
  script,            // From Script
  timeline           // From Render
} = ctx.artifacts;

// Pipeline calls packaging
const result = await packageAssets(ctx);
```

### Outbound Interfaces

```typescript
// To Storage: Upload all assets
await supabase.storage
  .from('generated-assets')
  .upload(storagePath, fileBuffer);

// To Database: Save asset records
await supabase.from('assets').insert(assetRecords);

// To Frontend (via API): Download URLs
GET /api/v1/jobs/:jobId/assets
Response: { assets: [...], manifest: {...} }
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    PACKAGING SUBSYSTEM                           │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Render  │  │  Voice   │  │ Alignment│  │  Image   │        │
│  │ (video)  │  │ (audio)  │  │(captions)│  │ (images) │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │             │             │             │               │
│       └─────────────┴─────────────┴─────────────┘               │
│                           │                                     │
│           ┌───────────────┼───────────────┐                     │
│           ▼               ▼               ▼                     │
│    ┌───────────┐   ┌───────────┐   ┌───────────┐               │
│    │  Upload   │   │  Generate │   │  Create   │               │
│    │ to Storage│   │  Manifest │   │    ZIP    │               │
│    └─────┬─────┘   └─────┬─────┘   └─────┬─────┘               │
│          │               │               │                      │
│          └───────────────┴───────────────┘                      │
│                          │                                      │
│                          ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Output                                  │  │
│  │  - Public URLs for all assets                            │  │
│  │  - manifest.json with metadata                           │  │
│  │  - assets.zip download bundle                            │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       ┌───────────┐   ┌───────────┐   ┌───────────┐
       │  Storage  │   │  Database │   │  Frontend │
       │  (R2/S3)  │   │  (assets) │   │ (download)│
       └───────────┘   └───────────┘   └───────────┘
```

### Asset Bundle Output

After packaging completes, the following is available:

```typescript
// ctx.artifacts after packaging
{
  // Uploaded asset URLs
  assetUrls: {
    video: 'https://cdn.canvascast.ai/jobs/xxx/video.mp4',
    audio: 'https://cdn.canvascast.ai/jobs/xxx/audio.mp3',
    captions: 'https://cdn.canvascast.ai/jobs/xxx/captions.srt',
    images: ['https://cdn.canvascast.ai/jobs/xxx/images/001.png', ...],
    zip: 'https://cdn.canvascast.ai/jobs/xxx/assets.zip',
    manifest: 'https://cdn.canvascast.ai/jobs/xxx/manifest.json'
  },
  
  // Manifest for API response
  manifest: AssetManifest
}
```
