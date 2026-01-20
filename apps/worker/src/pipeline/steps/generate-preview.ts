/**
 * Generate Preview Step
 *
 * REMOTION-006: Preview Generation
 * Acceptance criteria:
 * - Preview generated in <10s
 * - Thumbnail saved to storage
 * - Shown in UI
 *
 * This step generates a quick thumbnail/preview of the video
 * before the full render. It uses the first generated image
 * and creates a thumbnail at lower resolution for quick loading.
 */

import { createClient } from "@supabase/supabase-js";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import type { PipelineContext, StepResult } from "../types";
import { createStepResult, createStepError } from "../types";

const execAsync = promisify(exec);

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Generate a preview thumbnail from the first generated image
 *
 * This is a fast operation that creates a thumbnail for the UI
 * to show before the full video render completes. The thumbnail
 * is generated at 640x360 resolution (16:9 aspect ratio) for
 * quick loading in the browser.
 *
 * @param ctx - Pipeline context with artifacts
 * @returns StepResult with thumbnailPath
 */
export async function generatePreview(
  ctx: PipelineContext
): Promise<StepResult<{ thumbnailPath: string }>> {
  try {
    const imagePaths = ctx.artifacts.imagePaths;

    // Validate that we have images to work with
    if (!imagePaths || imagePaths.length === 0) {
      return createStepError(
        "ERR_PREVIEW",
        "No images available for preview generation"
      );
    }

    console.log("[Preview] Generating thumbnail preview...");

    // Create temporary directory for processing
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "canvascast-preview-")
    );

    // Download the first image from storage
    const firstImagePath = imagePaths[0];
    const cleanPath = firstImagePath.startsWith("project-assets/")
      ? firstImagePath.slice("project-assets/".length)
      : firstImagePath;

    const localImagePath = path.join(tempDir, "source_image.png");
    const { data: imageData, error: downloadError } = await supabase.storage
      .from("project-assets")
      .download(cleanPath);

    if (downloadError || !imageData) {
      await fs.rm(tempDir, { recursive: true, force: true });
      return createStepError(
        "ERR_PREVIEW",
        `Failed to download source image: ${downloadError?.message || "Unknown error"}`
      );
    }

    // Save image locally
    await fs.writeFile(
      localImagePath,
      Buffer.from(await imageData.arrayBuffer())
    );
    console.log("[Preview] Downloaded source image");

    // Generate thumbnail using ffmpeg
    // Resolution: 640x360 (16:9 aspect ratio) for fast loading
    const thumbnailPath = path.join(tempDir, "thumbnail.jpg");
    const ffmpegCmd = `ffmpeg -y -i "${localImagePath}" -vf "scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2" -q:v 5 "${thumbnailPath}"`;

    console.log("[Preview] Generating thumbnail with ffmpeg...");
    await execAsync(ffmpegCmd, { timeout: 5000 }); // 5 second timeout for fast preview
    console.log("[Preview] Thumbnail generated");

    // Upload thumbnail to storage
    const thumbnailStoragePath = `${ctx.outputPath}/thumbnail.jpg`;
    const thumbnailData = await fs.readFile(thumbnailPath);

    console.log(`[Preview] Uploading thumbnail to: ${thumbnailStoragePath}`);
    const { error: uploadError } = await supabase.storage
      .from("project-outputs")
      .upload(thumbnailStoragePath, thumbnailData, {
        upsert: true,
        contentType: "image/jpeg",
      });

    if (uploadError) {
      await fs.rm(tempDir, { recursive: true, force: true });
      return createStepError(
        "ERR_PREVIEW",
        `Failed to upload thumbnail: ${uploadError.message}`
      );
    }

    console.log("[Preview] Thumbnail uploaded successfully");

    // Create asset record for the thumbnail
    const { error: assetError } = await supabase.from("assets").insert({
      project_id: ctx.projectId,
      user_id: ctx.userId,
      job_id: ctx.jobId,
      type: "thumbnail",
      path: thumbnailStoragePath,
      meta: {
        width: 640,
        height: 360,
        generatedAt: new Date().toISOString(),
      },
    });

    if (assetError) {
      console.warn(
        `[Preview] Failed to create asset record: ${assetError.message}`
      );
      // Don't fail the step if asset record creation fails
    }

    // Cleanup temporary files
    await fs.rm(tempDir, { recursive: true, force: true });

    console.log("[Preview] Preview generation complete");

    return createStepResult({ thumbnailPath: thumbnailStoragePath });
  } catch (error) {
    return createStepError(
      "ERR_PREVIEW",
      error instanceof Error
        ? error.message
        : "Unknown error generating preview"
    );
  }
}
