import { createAdminSupabase } from "../../lib/supabase";
import type { PipelineContext, StepResult } from "../types";
import { createStepResult, createStepError } from "../types";
import { createEmailQueue } from "../../queues/email";
import { sendJobCompleteEmail } from "../../notify";

/**
 * Notify Complete Step
 *
 * Final step in the pipeline that:
 * 1. Finalizes job credits (converts reserved credits to usage)
 * 2. Queues email notification for job completion
 * 3. Logs completion
 */
export async function notifyComplete(
  ctx: PipelineContext
): Promise<StepResult<Record<string, never>>> {
  try {
    console.log("[Notify] Finalizing job completion...");

    const supabase = createAdminSupabase();

    // Calculate final cost (for now, use reserved amount)
    // In future, this could be adjusted based on actual resource usage
    const finalCost = ctx.job.cost_credits_reserved;

    // Finalize credits using Supabase RPC function
    console.log(`[Notify] Finalizing ${finalCost} credits for job ${ctx.jobId}...`);
    const { error: creditError } = await supabase.rpc("finalize_job_credits", {
      p_user_id: ctx.userId,
      p_job_id: ctx.jobId,
      p_final_cost: finalCost,
    });

    if (creditError) {
      console.error("[Notify] Credit finalization error:", creditError);
      return createStepError(
        "ERR_NOTIFY_COMPLETE",
        `Credit finalization failed: ${creditError.message}`,
        creditError
      );
    }

    console.log("[Notify] Credits finalized successfully");

    // Queue email notification for job completion
    try {
      const emailQueue = createEmailQueue();
      const videoPath = ctx.artifacts.videoPath || '';
      const downloadUrl = videoPath ? `${process.env.APP_URL || 'https://canvascast.ai'}/api/download/${ctx.jobId}` : '';

      // Calculate duration from narrationDurationMs
      const durationMs = ctx.artifacts.narrationDurationMs || 0;
      const minutes = Math.floor(durationMs / 60000);
      const seconds = Math.floor((durationMs % 60000) / 1000);
      const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;

      await sendJobCompleteEmail(emailQueue, {
        userId: ctx.userId,
        jobId: ctx.jobId,
        projectId: ctx.projectId,
        projectTitle: ctx.project?.title || 'Your Video',
        duration,
        credits: finalCost,
        downloadUrl,
      });

      console.log("[Notify] Job completion email queued");
    } catch (emailError) {
      // Email notification failure should not fail the entire step
      console.error("[Notify] Failed to queue completion email:", emailError);
    }

    console.log("[Notify] Job completed successfully");

    return createStepResult({});
  } catch (error) {
    console.error("[Notify] Error:", error);
    return createStepError(
      "ERR_NOTIFY_COMPLETE",
      error instanceof Error ? error.message : "Unknown error notifying completion",
      error
    );
  }
}
