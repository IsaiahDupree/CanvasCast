# PRD: Storage & CDN

**Subsystem:** Storage  
**Version:** 1.0  
**Status:** Implemented  
**Owner:** Isaiah  

---

## 1. Overview

The Storage & CDN subsystem manages file storage for generated assets (videos, images, audio) using Supabase Storage (backed by S3/R2). It provides fast global delivery through CDN and handles file lifecycle management.

### Business Goal
Deliver generated assets quickly and reliably to users worldwide while minimizing storage costs.

---

## 2. User Stories

### US-1: Fast Downloads
**As a** user  
**I want** fast video downloads  
**So that** I can get my content quickly

### US-2: Reliable Access
**As a** user  
**I want** my videos available anytime  
**So that** I can download them later

### US-3: Secure Access
**As a** user  
**I want** only my assets accessible to me  
**So that** my content is private

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         STORAGE ARCHITECTURE                             │
│                                                                         │
│  ┌─────────────┐                                                        │
│  │   Worker    │──── Upload ────►┌──────────────────┐                  │
│  │ (generate)  │                 │                  │                  │
│  └─────────────┘                 │  Supabase        │                  │
│                                  │  Storage         │                  │
│  ┌─────────────┐                 │                  │                  │
│  │    API      │──── Signed ────►│  ┌────────────┐  │                  │
│  │  (upload)   │     URLs        │  │   Bucket   │  │                  │
│  └─────────────┘                 │  │ generated- │  │                  │
│                                  │  │   assets   │  │                  │
│                                  │  └────────────┘  │                  │
│                                  │  ┌────────────┐  │                  │
│                                  │  │   Bucket   │  │──── CDN ───►     │
│                                  │  │   voice-   │  │              ┌───┴───┐
│                                  │  │  samples   │  │              │ Users │
│                                  │  └────────────┘  │              └───────┘
│  ┌─────────────┐                 │  ┌────────────┐  │                  │
│  │  Frontend   │◄─── Download ───│  │   Bucket   │  │                  │
│  │  (access)   │                 │  │   temp-    │  │                  │
│  └─────────────┘                 │  │ processing │  │                  │
│                                  │  └────────────┘  │                  │
│                                  └──────────────────┘                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Storage Buckets

### Bucket Configuration

| Bucket | Access | Purpose | Retention |
|--------|--------|---------|-----------|
| `generated-assets` | Public | Final videos, images, audio | 90 days |
| `voice-samples` | Private | User voice uploads | Permanent |
| `temp-processing` | Private | Intermediate pipeline files | 24 hours |

### Bucket Setup
```sql
-- Create buckets via Supabase dashboard or migration
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES 
  ('generated-assets', 'generated-assets', true, 524288000),   -- 500MB
  ('voice-samples', 'voice-samples', false, 52428800),          -- 50MB
  ('temp-processing', 'temp-processing', false, 1073741824);   -- 1GB
```

---

## 5. File Organization

### Directory Structure
```
generated-assets/
├── users/
│   └── {user_id}/
│       └── jobs/
│           └── {job_id}/
│               ├── video.mp4
│               ├── audio.mp3
│               ├── captions.srt
│               ├── captions.vtt
│               ├── manifest.json
│               ├── assets.zip
│               ├── images/
│               │   ├── scene_001.png
│               │   ├── scene_002.png
│               │   └── ...
│               └── thumbnails/
│                   ├── thumb_1080.jpg
│                   ├── thumb_540.jpg
│                   └── thumb_270.jpg

voice-samples/
└── users/
    └── {user_id}/
        └── {profile_id}/
            └── sample.wav

temp-processing/
└── jobs/
    └── {job_id}/
        ├── narration_raw.wav
        ├── whisper_output.json
        └── remotion_bundle/
```

---

## 6. Functional Requirements

### FR-1: File Upload

```typescript
async function uploadAsset(
  bucket: string,
  path: string,
  file: Buffer | Blob,
  options: UploadOptions
): Promise<UploadResult> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      contentType: options.mimeType,
      cacheControl: options.cacheControl || '31536000',
      upsert: options.upsert || false,
    });
  
  if (error) throw new StorageError(error.message);
  
  return {
    path: data.path,
    fullPath: data.fullPath,
  };
}
```

### FR-2: Get Public URL

```typescript
function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);
  
  return data.publicUrl;
}

// With CDN transformation
function getCdnUrl(path: string, transforms?: ImageTransforms): string {
  const baseUrl = process.env.SUPABASE_URL;
  const params = transforms 
    ? `?width=${transforms.width}&quality=${transforms.quality}`
    : '';
  return `${baseUrl}/storage/v1/object/public/generated-assets/${path}${params}`;
}
```

### FR-3: Signed URLs (Private Buckets)

```typescript
async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);
  
  if (error) throw new StorageError(error.message);
  
  return data.signedUrl;
}

// For downloads with custom filename
async function getSignedDownloadUrl(
  bucket: string,
  path: string,
  filename: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600, {
      download: filename,
    });
  
  return data.signedUrl;
}
```

### FR-4: File Deletion

```typescript
async function deleteAsset(bucket: string, path: string): Promise<void> {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);
  
  if (error) throw new StorageError(error.message);
}

// Bulk delete job assets
async function deleteJobAssets(jobId: string): Promise<void> {
  const { data: files } = await supabase.storage
    .from('generated-assets')
    .list(`users/${userId}/jobs/${jobId}`);
  
  if (files?.length) {
    const paths = files.map(f => `users/${userId}/jobs/${jobId}/${f.name}`);
    await supabase.storage.from('generated-assets').remove(paths);
  }
}
```

---

## 7. Storage Policies (RLS)

### Public Bucket (generated-assets)
```sql
-- Anyone can read
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'generated-assets');

-- Only service role can write
CREATE POLICY "Service write access"
ON storage.objects FOR INSERT
USING (
  bucket_id = 'generated-assets' 
  AND auth.role() = 'service_role'
);
```

### Private Bucket (voice-samples)
```sql
-- Users can read their own files
CREATE POLICY "User read own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'voice-samples'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Users can upload to their folder
CREATE POLICY "User upload to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'voice-samples'
  AND (storage.foldername(name))[2] = auth.uid()::text
);
```

---

## 8. CDN Configuration

### Cache Headers
```typescript
const CACHE_CONFIG = {
  // Static assets (images, videos)
  static: {
    cacheControl: 'public, max-age=31536000, immutable', // 1 year
  },
  
  // Dynamic content (manifests)
  dynamic: {
    cacheControl: 'public, max-age=3600, s-maxage=86400', // 1hr browser, 24hr CDN
  },
  
  // No cache (temporary files)
  noCache: {
    cacheControl: 'no-cache, no-store, must-revalidate',
  },
};
```

### CDN Edge Locations
Supabase Storage uses Cloudflare or compatible CDN with global edge locations for fast delivery.

---

## 9. File Lifecycle

### Retention Policy
```typescript
const RETENTION_POLICY = {
  'generated-assets': 90,  // days
  'voice-samples': null,   // permanent
  'temp-processing': 1,    // days
};

// Cleanup job (runs daily)
async function cleanupExpiredAssets(): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  
  // Find expired jobs
  const { data: expiredJobs } = await supabase
    .from('jobs')
    .select('id, user_id')
    .lt('created_at', cutoff.toISOString());
  
  for (const job of expiredJobs) {
    await deleteJobAssets(job.id);
    
    // Update job record
    await supabase
      .from('jobs')
      .update({ assets_deleted: true })
      .eq('id', job.id);
  }
}
```

### Temp Cleanup
```typescript
// Cleanup temp files after pipeline completion
async function cleanupTempFiles(jobId: string): Promise<void> {
  const { data: files } = await supabase.storage
    .from('temp-processing')
    .list(`jobs/${jobId}`);
  
  if (files?.length) {
    const paths = files.map(f => `jobs/${jobId}/${f.name}`);
    await supabase.storage.from('temp-processing').remove(paths);
  }
}
```

---

## 10. Upload Strategies

### Large File Upload (Multipart)
```typescript
async function uploadLargeFile(
  bucket: string,
  path: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    
    await supabase.storage
      .from(bucket)
      .upload(`${path}.part${i}`, chunk);
    
    onProgress?.((i + 1) / totalChunks * 100);
  }
  
  // Combine chunks (server-side)
  return await combineChunks(bucket, path, totalChunks);
}
```

### Stream Upload (Worker)
```typescript
async function uploadStream(
  bucket: string,
  path: string,
  stream: ReadableStream,
  size: number
): Promise<string> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  
  const buffer = Buffer.concat(chunks);
  
  const { data } = await supabase.storage
    .from(bucket)
    .upload(path, buffer);
  
  return getPublicUrl(bucket, data.path);
}
```

---

## 11. Error Handling

| Error | Cause | Recovery |
|-------|-------|----------|
| `STORAGE_QUOTA_EXCEEDED` | Bucket full | Cleanup old assets |
| `FILE_TOO_LARGE` | Exceeds limit | Compress or split |
| `INVALID_MIME_TYPE` | Wrong format | Validate before upload |
| `PERMISSION_DENIED` | RLS violation | Check policies |

```typescript
class StorageError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

async function uploadWithRetry(
  bucket: string,
  path: string,
  file: Buffer,
  maxRetries = 3
): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await uploadAsset(bucket, path, file);
    } catch (error) {
      if (!error.retryable || attempt === maxRetries) throw error;
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }
}
```

---

## 12. Metrics

| Metric | Description |
|--------|-------------|
| `storage_upload_size_bytes` | Upload sizes |
| `storage_download_count` | Download requests |
| `storage_bucket_size_gb` | Total storage used |
| `cdn_cache_hit_rate` | CDN effectiveness |
| `storage_errors` | Failed operations |

---

## 13. System Integration

### Communicates With

| Subsystem | Direction | Mechanism | Purpose |
|-----------|-----------|-----------|---------|
| **Worker** | Worker → Storage | Supabase client | Upload generated assets |
| **API** | API → Storage | Supabase client | Voice profile uploads |
| **Frontend** | Frontend → Storage | Supabase client | Downloads, voice upload |
| **Packaging** | Packaging → Storage | Supabase client | Final asset upload |
| **Database** | Storage → DB | Asset records | Track uploaded files |

### Data Flow
```
┌─────────────────────────────────────────────────────────────────┐
│                      STORAGE SUBSYSTEM                           │
│                                                                 │
│  WRITE PATH                           READ PATH                 │
│  ┌──────────────┐                     ┌──────────────┐          │
│  │   Worker     │──► Upload           │   Frontend   │          │
│  │ (generation) │    video/images     │  (download)  │◄── CDN   │
│  └──────────────┘         │           └──────────────┘    │     │
│                           │                                │     │
│  ┌──────────────┐         │           ┌──────────────────┐│     │
│  │     API      │──► Upload           │    Supabase      ││     │
│  │(voice upload)│    voice    ───────►│    Storage       │├────►│
│  └──────────────┘         │           │                  ││     │
│                           │           │ ┌──────────────┐ ││     │
│                           └──────────►│ │   Buckets    │ ││     │
│                                       │ │              │ ││     │
│                                       │ └──────────────┘ │◄─────┘
│                                       └──────────────────┘      │
│                                               │                  │
│                                               ▼                  │
│                                       ┌──────────────┐          │
│                                       │   Database   │          │
│                                       │ (asset refs) │          │
│                                       └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 14. Files

| File | Purpose |
|------|---------|
| `apps/worker/src/lib/storage.ts` | Storage utilities |
| `apps/worker/src/pipeline/steps/package-assets.ts` | Asset uploads |
| `apps/api/src/index.ts` | Voice upload endpoint |
| `apps/web/src/lib/supabase/storage.ts` | Frontend storage helpers |
| `supabase/config.toml` | Bucket configuration |
