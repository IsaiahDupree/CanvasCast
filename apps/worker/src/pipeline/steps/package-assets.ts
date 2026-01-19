import { createClient } from "@supabase/supabase-js";
import { exec } from "child_process";
import { promisify } from "util";
import archiver from "archiver";
import * as fs from "fs/promises";
import { createWriteStream } from "fs";
import * as path from "path";
import * as os from "os";
import type { PipelineContext, StepResult } from "../types";
import { createStepResult, createStepError } from "../types";

const execAsync = promisify(exec);

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface UploadedAsset {
  type: string;
  localPath: string;
  storagePath: string;
  publicUrl: string;
  sizeBytes: number;
  mimeType: string;
  metadata: Record<string, any>;
}

interface AssetManifest {
  version: string;
  jobId: string;
  projectId: string;
  createdAt: string;
  video: {
    url: string;
    duration: number;
    size: number;
  };
  audio: {
    mp3Url: string;
    duration: number;
  };
  captions: {
    srtUrl: string;
    wordCount: number;
    language: string;
  };
  images: Array<{
    sceneId: string;
    url: string;
  }>;
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

/**
 * Upload a file to Supabase Storage
 */
async function uploadFile(
  localPath: string,
  storagePath: string,
  mimeType: string,
  bucket: string = "generated-assets"
): Promise<UploadedAsset> {
  const fileBuffer = await fs.readFile(localPath);
  const stats = await fs.stat(localPath);

  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      cacheControl: "31536000",
      upsert: true,
    });

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(storagePath);

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

/**
 * Get asset type from MIME type
 */
function getAssetType(mimeType: string): string {
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.includes("text") || mimeType.includes("srt")) return "captions";
  if (mimeType === "application/zip") return "zip";
  if (mimeType === "application/json") return "manifest";
  return "other";
}

/**
 * Download file from storage to local path
 */
async function downloadFromStorage(
  storagePath: string,
  localPath: string,
  bucket: string = "project-assets"
): Promise<void> {
  // Remove bucket prefix if present
  const cleanPath = storagePath.startsWith(`${bucket}/`)
    ? storagePath.slice(`${bucket}/`.length)
    : storagePath;

  const { data, error } = await supabase.storage.from(bucket).download(cleanPath);

  if (error || !data) {
    throw new Error(`Failed to download ${storagePath}: ${error?.message || "No data"}`);
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  await fs.writeFile(localPath, buffer);
}

/**
 * Generate thumbnails from video using ffmpeg
 */
async function generateThumbnails(
  videoPath: string,
  outputDir: string
): Promise<Record<string, string>> {
  const sizes = [
    { name: "large", width: 1080 },
    { name: "medium", width: 540 },
    { name: "small", width: 270 },
  ];

  const thumbnails: Record<string, string> = {};

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `thumb_${size.width}.jpg`);

    await execAsync(
      `ffmpeg -y -i "${videoPath}" -vf "thumbnail,scale=${size.width}:-1" -frames:v 1 -q:v 2 "${outputPath}"`
    );

    thumbnails[size.name] = outputPath;
  }

  return thumbnails;
}

/**
 * Create ZIP archive of all assets
 */
async function createZipArchive(
  tempDir: string,
  assets: UploadedAsset[],
  manifest: AssetManifest
): Promise<{ path: string; size: number }> {
  const outputPath = path.join(tempDir, "assets.zip");
  const output = createWriteStream(outputPath);
  const archive = archiver("zip", { zlib: { level: 6 } });

  // Check files synchronously first (before promise)
  const validAssets: UploadedAsset[] = [];
  for (const asset of assets) {
    try {
      const stats = await fs.stat(asset.localPath);
      if (stats.isFile()) {
        validAssets.push(asset);
      }
    } catch (error) {
      console.warn(`[Package] Skipping asset ${asset.localPath}:`, error);
    }
  }

  return new Promise((resolve, reject) => {
    output.on("close", async () => {
      const stats = await fs.stat(outputPath);
      resolve({ path: outputPath, size: stats.size });
    });

    output.on("error", reject);
    archive.on("error", reject);

    archive.pipe(output);

    // Add all valid assets
    for (const asset of validAssets) {
      const filename = path.basename(asset.storagePath);
      archive.file(asset.localPath, { name: filename });
    }

    // Add manifest
    archive.append(JSON.stringify(manifest, null, 2), {
      name: "manifest.json",
    });

    archive.finalize();
  });
}

/**
 * Generate asset manifest
 */
function generateManifest(
  ctx: PipelineContext,
  assets: UploadedAsset[],
  zipUrl: string,
  zipSize: number
): AssetManifest {
  const videoAsset = assets.find((a) => a.type === "video");
  const audioAsset = assets.find((a) => a.type === "audio");
  const captionsAsset = assets.find((a) => a.type === "captions");
  const imageAssets = assets.filter((a) => a.type === "image");

  return {
    version: "1.0",
    jobId: ctx.jobId,
    projectId: ctx.projectId,
    createdAt: new Date().toISOString(),
    video: {
      url: videoAsset?.publicUrl || "",
      duration: ctx.artifacts.narrationDurationMs || 0,
      size: videoAsset?.sizeBytes || 0,
    },
    audio: {
      mp3Url: audioAsset?.publicUrl || "",
      duration: ctx.artifacts.narrationDurationMs || 0,
    },
    captions: {
      srtUrl: captionsAsset?.publicUrl || "",
      wordCount: ctx.artifacts.whisperSegments?.length || 0,
      language: "en",
    },
    images: imageAssets.map((img, i) => ({
      sceneId: `s${i + 1}`,
      url: img.publicUrl,
    })),
    metadata: {
      title: ctx.project.title,
      description: ctx.artifacts.script?.sections[0]?.narrationText || "",
      niche: ctx.project.niche_preset,
      generatedAt: new Date().toISOString(),
    },
    download: {
      zipUrl,
      zipSize,
    },
  };
}

/**
 * Save asset records to database
 */
async function saveAssetRecords(
  jobId: string,
  userId: string,
  projectId: string,
  assets: UploadedAsset[]
): Promise<void> {
  const records = assets.map((asset) => ({
    job_id: jobId,
    user_id: userId,
    project_id: projectId,
    type: asset.type,
    path: asset.storagePath,
    meta: {
      size: asset.sizeBytes,
      mimeType: asset.mimeType,
      publicUrl: asset.publicUrl,
    },
  }));

  const { error } = await supabase.from("assets").insert(records);
  if (error) throw error;
}

/**
 * Package Assets Step
 *
 * Bundles all generated assets (video, audio, images, captions) into a downloadable package.
 * Uploads files to cloud storage, generates manifest files, and creates ZIP archives.
 */
export async function packageAssets(
  ctx: PipelineContext
): Promise<StepResult<{ zipPath: string }>> {
  let tempDir: string | null = null;

  try {
    // Validate required artifacts
    if (!ctx.artifacts.videoPath) {
      return createStepError("ERR_PACKAGING", "No video path available for packaging");
    }

    console.log("[Package] Starting asset packaging...");
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "canvascast-package-"));

    const assets: UploadedAsset[] = [];
    const basePath = `users/${ctx.userId}/jobs/${ctx.jobId}`;

    // Download and upload video
    console.log("[Package] Processing video...");
    const videoLocalPath = path.join(tempDir, "final.mp4");
    await downloadFromStorage(ctx.artifacts.videoPath, videoLocalPath, "project-outputs");
    const videoAsset = await uploadFile(
      videoLocalPath,
      `${basePath}/final.mp4`,
      "video/mp4",
      "generated-assets"
    );
    assets.push(videoAsset);

    // Download and upload audio
    if (ctx.artifacts.narrationPath) {
      console.log("[Package] Processing audio...");
      const audioLocalPath = path.join(tempDir, "audio.mp3");
      await downloadFromStorage(ctx.artifacts.narrationPath, audioLocalPath);
      const audioAsset = await uploadFile(
        audioLocalPath,
        `${basePath}/audio.mp3`,
        "audio/mpeg",
        "generated-assets"
      );
      assets.push(audioAsset);
    }

    // Download and upload captions
    if (ctx.artifacts.captionsSrtPath) {
      console.log("[Package] Processing captions...");
      const captionsLocalPath = path.join(tempDir, "captions.srt");
      await downloadFromStorage(ctx.artifacts.captionsSrtPath, captionsLocalPath);
      const captionsAsset = await uploadFile(
        captionsLocalPath,
        `${basePath}/captions.srt`,
        "text/plain",
        "generated-assets"
      );
      assets.push(captionsAsset);
    }

    // Download and upload images
    if (ctx.artifacts.imagePaths && ctx.artifacts.imagePaths.length > 0) {
      console.log(`[Package] Processing ${ctx.artifacts.imagePaths.length} images...`);
      for (let i = 0; i < ctx.artifacts.imagePaths.length; i++) {
        const imagePath = ctx.artifacts.imagePaths[i];
        const imageLocalPath = path.join(tempDir, `image_${i}.png`);
        await downloadFromStorage(imagePath, imageLocalPath);
        const imageAsset = await uploadFile(
          imageLocalPath,
          `${basePath}/images/scene_${String(i + 1).padStart(3, "0")}.png`,
          "image/png",
          "generated-assets"
        );
        assets.push(imageAsset);
      }
    }

    // Generate thumbnails
    console.log("[Package] Generating thumbnails...");
    const thumbnails = await generateThumbnails(videoLocalPath, tempDir);
    for (const [size, thumbnailPath] of Object.entries(thumbnails)) {
      const thumbnailAsset = await uploadFile(
        thumbnailPath,
        `${basePath}/thumbnails/thumb_${size}.jpg`,
        "image/jpeg",
        "generated-assets"
      );
      assets.push(thumbnailAsset);
    }

    // Create ZIP archive (preliminary manifest for ZIP contents)
    console.log("[Package] Creating ZIP archive...");
    const preliminaryManifest = generateManifest(ctx, assets, "", 0);
    const { path: zipPath, size: zipSize } = await createZipArchive(
      tempDir,
      assets,
      preliminaryManifest
    );

    // Upload ZIP
    console.log("[Package] Uploading ZIP archive...");
    const zipAsset = await uploadFile(
      zipPath,
      `${basePath}/assets.zip`,
      "application/zip",
      "generated-assets"
    );
    assets.push(zipAsset);

    // Generate final manifest with ZIP URL
    const manifest = generateManifest(ctx, assets, zipAsset.publicUrl, zipSize);

    // Upload manifest
    const manifestPath = path.join(tempDir, "manifest.json");
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    const manifestAsset = await uploadFile(
      manifestPath,
      `${basePath}/manifest.json`,
      "application/json",
      "generated-assets"
    );
    assets.push(manifestAsset);

    // Save asset records to database
    console.log("[Package] Saving asset records to database...");
    await saveAssetRecords(ctx.jobId, ctx.userId, ctx.projectId, assets);

    console.log("[Package] Asset packaging completed successfully");

    // Add zipPath to artifacts
    ctx.artifacts.zipPath = zipAsset.storagePath;

    return createStepResult({ zipPath: zipAsset.storagePath });
  } catch (error) {
    console.error("[Package] Error:", error);
    return createStepError(
      "ERR_PACKAGING",
      error instanceof Error ? error.message : "Unknown error packaging assets"
    );
  } finally {
    // Cleanup temp directory
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn("[Package] Failed to cleanup temp directory:", error);
      }
    }
  }
}
