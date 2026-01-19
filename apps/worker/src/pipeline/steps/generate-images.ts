import { createAdminSupabase } from "../../lib/supabase";
import { insertJobEvent } from "../../lib/db";
import OpenAI from "openai";
import type { PipelineContext, StepResult, VisualSlot } from "../types";
import { createStepResult, createStepError } from "../types";
import { createGeminiClient } from "../../lib/gemini";
import { featureFlags } from "../../lib/env";

const supabase = createAdminSupabase();

let openaiClient: OpenAI | null = null;
function getOpenAI() {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      // Allow browser mode in test environment
      dangerouslyAllowBrowser: process.env.NODE_ENV === 'test'
    });
  }
  return openaiClient;
}

const MAX_RETRIES = 2;
const MAX_CONCURRENT = 3;
const RATE_LIMIT_DELAY_MS = 1000;

export async function generateImages(
  ctx: PipelineContext
): Promise<StepResult<{ imagePaths: string[] }>> {
  try {
    await insertJobEvent(ctx.jobId, "IMAGE_GEN", "Starting image generation...");

    const visualPlan = ctx.artifacts.visualPlan;

    if (!visualPlan) {
      await insertJobEvent(ctx.jobId, "IMAGE_GEN", "No visual plan available", "error");
      return createStepError("ERR_IMAGE_GEN", "Visual plan is required for image generation");
    }

    if (!visualPlan.slots || visualPlan.slots.length === 0) {
      await insertJobEvent(ctx.jobId, "IMAGE_GEN", "No visual slots to process", "error");
      return createStepError("ERR_IMAGE_GEN", "Visual plan has no slots");
    }

    await insertJobEvent(
      ctx.jobId,
      "IMAGE_GEN",
      `Generating ${visualPlan.slots.length} images using ${featureFlags.imageProvider} provider`
    );

    const imagePaths: string[] = [];

    // Process in batches to avoid rate limits
    for (let i = 0; i < visualPlan.slots.length; i += MAX_CONCURRENT) {
      const batch = visualPlan.slots.slice(i, i + MAX_CONCURRENT);
      await insertJobEvent(
        ctx.jobId,
        "IMAGE_GEN",
        `Processing batch ${Math.floor(i / MAX_CONCURRENT) + 1}/${Math.ceil(visualPlan.slots.length / MAX_CONCURRENT)} (${batch.length} images)`
      );

      const batchResults = await Promise.all(
        batch.map((slot, batchIndex) =>
          generateSingleImage(ctx, slot, i + batchIndex, MAX_RETRIES)
        )
      );

      imagePaths.push(...batchResults);

      // Rate limiting pause between batches (except for last batch)
      if (i + MAX_CONCURRENT < visualPlan.slots.length) {
        await sleep(RATE_LIMIT_DELAY_MS);
      }
    }

    await insertJobEvent(
      ctx.jobId,
      "IMAGE_GEN",
      `Successfully generated ${imagePaths.length} images`
    );

    // Update context artifacts
    ctx.artifacts.imagePaths = imagePaths;

    return createStepResult({ imagePaths });
  } catch (error) {
    return createStepError(
      "ERR_IMAGE_GEN",
      error instanceof Error ? error.message : "Unknown error generating images"
    );
  }
}

/**
 * Generate a single image with retry logic
 */
async function generateSingleImage(
  ctx: PipelineContext,
  slot: VisualSlot,
  index: number,
  retriesLeft: number
): Promise<string> {
  try {
    await insertJobEvent(
      ctx.jobId,
      "IMAGE_GEN",
      `Generating image ${index + 1}: ${slot.id}`
    );

    // Generate image using configured provider
    let imageBuffer: Buffer;

    if (featureFlags.imageProvider === 'gemini' && process.env.GEMINI_API_KEY) {
      imageBuffer = await generateWithGemini(slot.prompt);
    } else if (featureFlags.imageProvider === 'openai' || !process.env.GEMINI_API_KEY) {
      imageBuffer = await generateWithOpenAI(slot.prompt);
    } else {
      throw new Error(`Unsupported image provider: ${featureFlags.imageProvider}`);
    }

    // Upload to storage
    const filename = `${slot.id}.png`;
    const storagePath = `${ctx.basePath}/images/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from("project-assets")
      .upload(storagePath, imageBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // Create asset record
    const { error: assetError } = await supabase.from("assets").insert({
      project_id: ctx.projectId,
      user_id: ctx.userId,
      job_id: ctx.jobId,
      type: "image",
      storage_path: storagePath,
      metadata_json: {
        slotId: slot.id,
        prompt: slot.prompt,
        index,
        provider: featureFlags.imageProvider,
      },
    });

    if (assetError) {
      throw new Error(`Failed to create asset record: ${assetError.message}`);
    }

    await insertJobEvent(
      ctx.jobId,
      "IMAGE_GEN",
      `Generated image ${index + 1}: ${filename}`
    );

    return storagePath;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Retry logic
    if (retriesLeft > 0) {
      await insertJobEvent(
        ctx.jobId,
        "IMAGE_GEN",
        `Failed to generate image ${index + 1}, retrying... (${retriesLeft} retries left)`,
        "warning"
      );

      // Exponential backoff
      await sleep(Math.pow(2, MAX_RETRIES - retriesLeft) * 1000);

      return generateSingleImage(ctx, slot, index, retriesLeft - 1);
    }

    throw new Error(`Failed to generate image ${slot.id} after ${MAX_RETRIES} retries: ${errorMessage}`);
  }
}

/**
 * Generate image using Gemini Imagen API
 */
async function generateWithGemini(prompt: string): Promise<Buffer> {
  const gemini = createGeminiClient();

  return await gemini.generateImage({
    prompt: enhancePromptForGemini(prompt),
    aspectRatio: '9:16',
    numberOfImages: 1,
    safetyFilterLevel: 'block_some',
    personGeneration: 'allow_adult',
  });
}

/**
 * Generate image using OpenAI DALL-E
 */
async function generateWithOpenAI(prompt: string): Promise<Buffer> {
  const openai = getOpenAI();
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: enhancePromptForOpenAI(prompt),
    n: 1,
    size: "1024x1792", // Vertical format for shorts
    quality: "standard",
    response_format: "b64_json",
  });

  const base64Image = response.data[0].b64_json;
  if (!base64Image) {
    throw new Error("No image data returned from OpenAI");
  }

  return Buffer.from(base64Image, "base64");
}

/**
 * Enhance prompt specifically for Gemini
 */
function enhancePromptForGemini(prompt: string): string {
  return `${prompt}. High quality, professional, suitable for vertical video (9:16 aspect ratio). No text or watermarks.`;
}

/**
 * Enhance prompt specifically for OpenAI DALL-E
 */
function enhancePromptForOpenAI(prompt: string): string {
  // OpenAI has a 4000 character limit
  const maxLength = 3900;
  let enhanced = prompt;

  if (enhanced.length > maxLength) {
    enhanced = enhanced.substring(0, maxLength);
  }

  return enhanced;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
