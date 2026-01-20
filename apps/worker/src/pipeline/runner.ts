import { createClient } from "@supabase/supabase-js";
import type { JobStatus, JobErrorCode } from "@canvascast/shared";
import {
  type PipelineContext,
  type JobRow,
  type ProjectRow,
  type JobEventPayload,
  createBasePath,
  createOutputPath,
} from "./types";

// Step imports
import { ingestInputs } from "./steps/ingest-inputs";
import { generateScript } from "./steps/generate-script";
import { moderateOutput } from "./steps/moderate-output";
import { generateVoice } from "./steps/generate-voice";
import { runAlignment } from "./steps/run-alignment";
import { planVisuals } from "./steps/plan-visuals";
import { generateImages } from "./steps/generate-images";
import { buildTimeline } from "./steps/build-timeline";
import { generatePreview } from "./steps/generate-preview"; // REMOTION-006
import { renderVideo } from "./steps/render-video";
import { packageAssets } from "./steps/package-assets";

// Recovery imports
import { saveCheckpoint, clearCheckpoint } from "./recovery";

// Refund service (RESIL-002)
import { shouldRefundCredits } from "../services/refund";

// Metrics tracking (ANALYTICS-003)
import { PipelineMetrics } from "./metrics";

// Cost tracking (ANALYTICS-004)
import { CostTracker } from "../services/cost-tracker";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// PIPELINE RUNNER
// ============================================

export async function runPipeline(job: JobRow): Promise<void> {
  console.log(`[Pipeline] Starting job ${job.id}`);

  // Initialize metrics tracking (ANALYTICS-003)
  const metrics = new PipelineMetrics(job.id, job.user_id);

  // Initialize cost tracking (ANALYTICS-004)
  const costTracker = new CostTracker(job.id, job.user_id);

  // Fetch project
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", job.project_id)
    .single();

  if (projectError || !project) {
    await failJob(job.id, "ERR_UNKNOWN", "Failed to fetch project", metrics);
    return;
  }

  // Build context
  const ctx: PipelineContext = {
    job,
    project: project as ProjectRow,
    userId: job.user_id,
    projectId: job.project_id,
    jobId: job.id,
    basePath: createBasePath(job.user_id, job.project_id, job.id),
    outputPath: createOutputPath(job.user_id, job.project_id, job.id),
    artifacts: {},
    costTracker, // ANALYTICS-004: Pass cost tracker to all steps
  };

  // RESIL-004: Check if this is a step retry
  // If job has checkpoint_state, restore artifacts and resume from current status
  let resumeFromStep: JobStatus | null = null;
  if (job.checkpoint_state) {
    const checkpoint = job.checkpoint_state as any;
    console.log(`[Pipeline] Resuming from checkpoint at step ${job.status}`);
    ctx.artifacts = checkpoint.artifacts || {};
    ctx.job.progress = checkpoint.progress || 0;
    resumeFromStep = job.status;
  }

  try {
    // Step 1: Ingest inputs
    if (!resumeFromStep || resumeFromStep === "SCRIPTING") {
      metrics.startStep("SCRIPTING");
      await updateJobStatus(job.id, "SCRIPTING", 5);
      await logEvent(job.id, "SCRIPTING", "Ingesting inputs...");
      const inputsResult = await ingestInputs(ctx);
      if (!inputsResult.success) {
        metrics.endStep("SCRIPTING", "failed", inputsResult.error!.code, inputsResult.error!.message);
        await failJob(job.id, inputsResult.error!.code, inputsResult.error!.message, metrics);
        return;
      }
      ctx.artifacts.mergedInputText = inputsResult.data!.mergedText;
      metrics.endStep("SCRIPTING", "success");
    }

    // Step 2: Generate script
    if (!resumeFromStep || resumeFromStep === "SCRIPTING") {
      await updateJobStatus(job.id, "SCRIPTING", 15);
      await logEvent(job.id, "SCRIPTING", "Generating script...");
      const scriptResult = await generateScript(ctx);
      if (!scriptResult.success) {
        metrics.endStep("SCRIPTING", "failed", scriptResult.error!.code, scriptResult.error!.message);
        await failJob(job.id, scriptResult.error!.code, scriptResult.error!.message, metrics);
        return;
      }
      ctx.artifacts.script = scriptResult.data!.script;

      // MOD-002: Moderate generated script content
      await logEvent(job.id, "SCRIPTING", "Moderating script content...");
      const scriptModerationResult = await moderateOutput(ctx);
      if (!scriptModerationResult.success) {
        metrics.endStep("SCRIPTING", "failed", scriptModerationResult.error!.code, scriptModerationResult.error!.message);
        await failJob(job.id, scriptModerationResult.error!.code, scriptModerationResult.error!.message, metrics);
        return;
      }
    }

    // Step 3: Generate voice
    if (!resumeFromStep || resumeFromStep === "VOICE_GEN" || resumeFromStep === "SCRIPTING") {
      await updateJobStatus(job.id, "VOICE_GEN", 25);
      await logEvent(job.id, "VOICE_GEN", "Generating voice narration...");
      const voiceResult = await generateVoice(ctx);
      if (!voiceResult.success) {
        await failJob(job.id, voiceResult.error!.code, voiceResult.error!.message);
        return;
      }
      ctx.artifacts.narrationPath = voiceResult.data!.narrationPath;
      ctx.artifacts.narrationDurationMs = voiceResult.data!.durationMs;
    }

    // Step 4: Run alignment (Whisper)
    if (!resumeFromStep || ["ALIGNMENT", "VOICE_GEN", "SCRIPTING"].includes(resumeFromStep)) {
      await updateJobStatus(job.id, "ALIGNMENT", 40);
      await logEvent(job.id, "ALIGNMENT", "Running speech alignment...");
      const alignmentResult = await runAlignment(ctx);
      if (!alignmentResult.success) {
        await failJob(job.id, alignmentResult.error!.code, alignmentResult.error!.message);
        return;
      }
      ctx.artifacts.whisperSegments = alignmentResult.data!.segments;
      ctx.artifacts.captionsSrtPath = alignmentResult.data!.srtPath;
    }

    // Step 5: Plan visuals
    if (!resumeFromStep || !["RENDERING", "PACKAGING", "IMAGE_GEN", "TIMELINE_BUILD"].includes(resumeFromStep)) {
      await updateJobStatus(job.id, "VISUAL_PLAN", 50);
      await logEvent(job.id, "VISUAL_PLAN", "Planning visual timeline...");
      const planResult = await planVisuals(ctx);
      if (!planResult.success) {
        await failJob(job.id, planResult.error!.code, planResult.error!.message);
        return;
      }
      ctx.artifacts.visualPlan = planResult.data!.plan;

      // MOD-002: Moderate image prompts
      await logEvent(job.id, "VISUAL_PLAN", "Moderating image prompts...");
      const imageModerationResult = await moderateOutput(ctx);
      if (!imageModerationResult.success) {
        await failJob(job.id, imageModerationResult.error!.code, imageModerationResult.error!.message);
        return;
      }
    }

    // Step 6: Generate images (checkpoint threshold - can retry from here)
    if (!resumeFromStep || resumeFromStep === "IMAGE_GEN" || !["RENDERING", "PACKAGING", "TIMELINE_BUILD"].includes(resumeFromStep)) {
      await updateJobStatus(job.id, "IMAGE_GEN", 55);
      await logEvent(job.id, "IMAGE_GEN", `Generating ${ctx.artifacts.visualPlan?.totalImages ?? 0} images...`);
      const imagesResult = await generateImages(ctx);
      if (!imagesResult.success) {
        await failJob(job.id, imagesResult.error!.code, imagesResult.error!.message);
        return;
      }
      ctx.artifacts.imagePaths = imagesResult.data!.imagePaths;

      // Save checkpoint after image generation (expensive step)
      await saveCheckpoint(ctx, "IMAGE_GEN");
    }

    // Step 7: Build timeline
    if (!resumeFromStep || resumeFromStep === "TIMELINE_BUILD" || !["RENDERING", "PACKAGING"].includes(resumeFromStep)) {
      await updateJobStatus(job.id, "TIMELINE_BUILD", 75);
      await logEvent(job.id, "TIMELINE_BUILD", "Building timeline...");
      const timelineResult = await buildTimeline(ctx);
      if (!timelineResult.success) {
        await failJob(job.id, timelineResult.error!.code, timelineResult.error!.message);
        return;
      }
      ctx.artifacts.timeline = timelineResult.data!.timeline;
    }

    // Step 7.5: Generate preview thumbnail (REMOTION-006)
    // This is a fast operation that creates a preview before the full render
    if (!resumeFromStep || resumeFromStep === "TIMELINE_BUILD" || !["RENDERING", "PACKAGING"].includes(resumeFromStep)) {
      await logEvent(job.id, "TIMELINE_BUILD", "Generating preview thumbnail...");
      const previewResult = await generatePreview(ctx);
      if (!previewResult.success) {
        // Preview generation failure is not critical - log and continue
        console.warn(`[Pipeline] Preview generation failed: ${previewResult.error?.message}`);
      } else {
        ctx.artifacts.thumbnailPath = previewResult.data!.thumbnailPath;
        console.log(`[Pipeline] Preview thumbnail generated: ${previewResult.data!.thumbnailPath}`);
      }
    }

    // Step 8: Render video
    if (!resumeFromStep || resumeFromStep === "RENDERING" || resumeFromStep !== "PACKAGING") {
      await updateJobStatus(job.id, "RENDERING", 80);
      await logEvent(job.id, "RENDERING", "Rendering video with Remotion...");
      const renderResult = await renderVideo(ctx);
      if (!renderResult.success) {
        await failJob(job.id, renderResult.error!.code, renderResult.error!.message);
        return;
      }
      ctx.artifacts.videoPath = renderResult.data!.videoPath;
    }

    // Step 9: Package assets
    await updateJobStatus(job.id, "PACKAGING", 95);
    await logEvent(job.id, "PACKAGING", "Packaging assets...");
    const packageResult = await packageAssets(ctx);
    if (!packageResult.success) {
      // If packaging fails but video exists, still mark as ready
      console.warn(`[Pipeline] Packaging failed but video exists: ${packageResult.error?.message}`);
    } else {
      ctx.artifacts.zipPath = packageResult.data!.zipPath;
    }

    // Success!
    metrics.markComplete();
    await completeJob(job.id, ctx, metrics);

    // ANALYTICS-004: Save cost tracking data
    if (ctx.costTracker) {
      await ctx.costTracker.saveToDB();
    }

    // Clear checkpoint on successful completion
    await clearCheckpoint(job.id);

  } catch (error) {
    console.error(`[Pipeline] Unexpected error:`, error);
    await failJob(job.id, "ERR_UNKNOWN", error instanceof Error ? error.message : "Unknown error", metrics);
  }
}

// ============================================
// HELPERS
// ============================================

async function updateJobStatus(jobId: string, status: JobStatus, progress: number): Promise<void> {
  await supabase
    .from("jobs")
    .update({ status, progress, updated_at: new Date().toISOString() })
    .eq("id", jobId);
}

async function logEvent(jobId: string, stage: JobStatus, message: string, meta?: Record<string, unknown>): Promise<void> {
  await supabase.from("job_events").insert({
    job_id: jobId,
    stage,
    message,
    meta: meta ?? {},
  });
}

async function failJob(jobId: string, errorCode: JobErrorCode, errorMessage: string, metrics?: PipelineMetrics): Promise<void> {
  console.error(`[Pipeline] Job ${jobId} failed: ${errorCode} - ${errorMessage}`);

  // Get current job state to determine refund eligibility (RESIL-002)
  const { data: job } = await supabase
    .from("jobs")
    .select("status, progress, cost_credits_reserved")
    .eq("id", jobId)
    .single();

  const currentStatus = job?.status || "QUEUED";
  const currentProgress = job?.progress || 0;
  const reservedCredits = job?.cost_credits_reserved || 0;

  // Determine if credits should be refunded based on completion threshold
  const shouldRefund = shouldRefundCredits(currentStatus, currentProgress);

  await supabase
    .from("jobs")
    .update({
      status: "FAILED",
      error_code: errorCode,
      error_message: errorMessage,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  await logEvent(jobId, "FAILED", errorMessage, {
    error_code: errorCode,
    refund_eligible: shouldRefund,
    progress: currentProgress,
    reserved_credits: reservedCredits,
  });

  // RESIL-002: Only refund credits if job failed before completion threshold
  if (shouldRefund) {
    console.log(`[Pipeline] Job ${jobId} failed at ${currentProgress}% - REFUNDING ${reservedCredits} credits`);
    await supabase.rpc("release_job_credits", { p_job_id: jobId });
  } else {
    console.log(`[Pipeline] Job ${jobId} failed at ${currentProgress}% - NO REFUND (threshold exceeded)`);
    // Credits remain reserved and will not be refunded
    // This acknowledges that significant work (TTS, Whisper, image gen) was performed
  }

  // ANALYTICS-003: Save metrics on failure
  if (metrics) {
    metrics.markComplete();
    await metrics.save();
  }

  // TODO: Send failure notification email
}

async function completeJob(jobId: string, ctx: PipelineContext, metrics?: PipelineMetrics): Promise<void> {
  console.log(`[Pipeline] Job ${jobId} completed successfully`);

  // Calculate final credits
  const durationMinutes = Math.ceil((ctx.artifacts.narrationDurationMs ?? 0) / 60000);
  const finalCredits = Math.max(1, durationMinutes);

  await supabase
    .from("jobs")
    .update({
      status: "READY",
      progress: 100,
      cost_credits_final: finalCredits,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  await logEvent(jobId, "READY", "Job completed successfully", {
    duration_ms: ctx.artifacts.narrationDurationMs,
    images_count: ctx.artifacts.imagePaths?.length ?? 0,
    final_credits: finalCredits,
  });

  // Finalize credits
  await supabase.rpc("finalize_job_credits", {
    p_user_id: ctx.userId,
    p_job_id: jobId,
    p_final_cost: finalCredits,
  });

  // Update project status
  await supabase
    .from("projects")
    .update({
      status: "ready",
      timeline_path: ctx.artifacts.timelinePath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.projectId);

  // ANALYTICS-003: Save metrics on success
  if (metrics) {
    await metrics.save();
  }

  // TODO: Send completion notification email
}
