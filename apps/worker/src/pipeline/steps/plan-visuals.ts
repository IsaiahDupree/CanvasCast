import { createAdminSupabase } from "../../lib/supabase";
import { insertJobEvent } from "../../lib/db";
import type { PipelineContext, StepResult, VisualPlan, VisualSlot, WhisperSegment } from "../types";
import { createStepResult, createStepError } from "../types";

const supabase = createAdminSupabase();

const DEFAULT_CADENCE_MS = 8000; // Change image every 8 seconds

export async function planVisuals(
  ctx: PipelineContext
): Promise<StepResult<{ plan: VisualPlan }>> {
  try {
    await insertJobEvent(ctx.jobId, "VISUAL_PLAN", "Planning visual sequence...");

    const script = ctx.artifacts.script;
    const segments = ctx.artifacts.whisperSegments;

    if (!script) {
      await insertJobEvent(ctx.jobId, "VISUAL_PLAN", "No script available", "error");
      return createStepError("ERR_VISUAL_PLAN", "Script artifact is required for visual planning");
    }

    if (!segments || segments.length === 0) {
      await insertJobEvent(ctx.jobId, "VISUAL_PLAN", "No whisper segments available", "error");
      return createStepError("ERR_VISUAL_PLAN", "Whisper segments are required for visual planning");
    }

    // Determine cadence based on image density setting
    let cadenceMs = DEFAULT_CADENCE_MS;
    if (ctx.project.image_density === "low") cadenceMs = 10000; // 10 seconds
    if (ctx.project.image_density === "normal") cadenceMs = 7000; // 7 seconds
    if (ctx.project.image_density === "high") cadenceMs = 4000; // 4 seconds

    await insertJobEvent(ctx.jobId, "VISUAL_PLAN", `Using ${ctx.project.image_density || 'normal'} image density (${cadenceMs}ms per image)`);

    const slots: VisualSlot[] = [];
    let slotId = 0;

    // Group segments into visual slots
    let currentSlotStart = 0;
    let currentText: string[] = [];

    for (const seg of segments) {
      const segStartMs = seg.start * 1000;
      const segEndMs = seg.end * 1000;

      currentText.push(seg.text);

      // Check if we should create a new slot
      if (segEndMs - currentSlotStart >= cadenceMs || seg === segments[segments.length - 1]) {
        // Find matching script section for visual keywords
        const sectionIdx = Math.floor(slotId / 3) % script.sections.length;
        const section = script.sections[sectionIdx];

        const prompt = buildImagePrompt(
          currentText.join(" "),
          section?.visualKeywords ?? [],
          ctx.project.visual_preset_id ?? "photorealistic"
        );

        slots.push({
          id: `slot_${String(slotId).padStart(3, "0")}`,
          startMs: currentSlotStart,
          endMs: segEndMs,
          text: currentText.join(" "),
          prompt,
          stylePreset: ctx.project.visual_preset_id ?? "photorealistic",
        });

        slotId++;
        currentSlotStart = segEndMs;
        currentText = [];
      }
    }

    const plan: VisualPlan = {
      slots,
      totalImages: slots.length,
      cadenceMs,
    };

    await insertJobEvent(ctx.jobId, "VISUAL_PLAN", `Created visual plan with ${slots.length} slots`);

    // Upload plan
    const planPath = `${ctx.basePath}/visuals/visual_plan.json`;
    const { error: uploadError } = await supabase.storage
      .from("project-assets")
      .upload(planPath, new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" }), { upsert: true });

    if (uploadError) {
      await insertJobEvent(ctx.jobId, "VISUAL_PLAN", `Failed to upload visual plan: ${uploadError.message}`, "error");
      return createStepError("ERR_VISUAL_PLAN", `Failed to upload visual plan: ${uploadError.message}`);
    }

    // Create asset record
    const { error: assetError } = await supabase.from("assets").insert({
      project_id: ctx.projectId,
      user_id: ctx.userId,
      job_id: ctx.jobId,
      type: "other", // visual_plan is stored as 'other' type with metadata
      storage_path: planPath,
      metadata_json: { totalImages: slots.length, cadenceMs, assetType: 'visual_plan' },
    });

    if (assetError) {
      await insertJobEvent(ctx.jobId, "VISUAL_PLAN", `Failed to create asset record: ${assetError.message}`, "error");
      return createStepError("ERR_VISUAL_PLAN", `Failed to create asset record: ${assetError.message}`);
    }

    // Update context artifacts
    ctx.artifacts.visualPlan = plan;

    return createStepResult({ plan });
  } catch (error) {
    return createStepError(
      "ERR_VISUAL_PLAN",
      error instanceof Error ? error.message : "Unknown error planning visuals"
    );
  }
}

function buildImagePrompt(text: string, keywords: string[], stylePreset: string): string {
  const stylePrefix = getStylePrefix(stylePreset);
  const keywordStr = keywords.length > 0 ? keywords.join(", ") : "";
  
  // Extract key concepts from text
  const cleanText = text.replace(/[^\w\s]/g, "").substring(0, 100);
  
  return `${stylePrefix}${keywordStr ? keywordStr + ", " : ""}scene depicting: ${cleanText}`;
}

function getStylePrefix(preset: string): string {
  const prefixes: Record<string, string> = {
    photorealistic: "photorealistic, high quality, cinematic lighting, ",
    illustration: "digital illustration, artistic, vibrant colors, ",
    minimalist: "minimalist, clean, simple, modern, ",
    cinematic: "cinematic, dramatic lighting, film still, 35mm, ",
    anime: "anime style, manga, Japanese animation, ",
  };
  return prefixes[preset] ?? prefixes.photorealistic;
}
