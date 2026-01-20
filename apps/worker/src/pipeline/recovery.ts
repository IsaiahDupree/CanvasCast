import { createAdminSupabase } from "../lib/supabase";
import { insertJobEvent } from "../lib/db";
import type { PipelineContext, PipelineArtifacts } from "./types";
import type { JobStatus } from "@canvascast/shared";

// ============================================
// CHECKPOINT TYPES
// ============================================

export interface CheckpointState {
  lastCompletedStep: JobStatus;
  artifacts: PipelineArtifacts;
  savedAt: string;
  progress: number;
}

export interface SaveCheckpointResult {
  success: boolean;
  lastCompletedStep: JobStatus;
  checkpointData: CheckpointState;
}

export interface RetryOptions {
  canRetryFromCheckpoint: boolean;
  nextStep?: JobStatus;
  message: string;
}

// ============================================
// PIPELINE STEP ORDER
// ============================================

const PIPELINE_STEPS: JobStatus[] = [
  "QUEUED",
  "SCRIPTING",
  "VOICE_GEN",
  "ALIGNMENT",
  "VISUAL_PLAN",
  "IMAGE_GEN",
  "TIMELINE_BUILD",
  "RENDERING",
  "PACKAGING",
  "READY",
  "FAILED"
];

// Checkpoint threshold: Only allow recovery from IMAGE_GEN onwards
// This is because image generation is expensive and time-consuming
const CHECKPOINT_THRESHOLD_STEP = "IMAGE_GEN";

// ============================================
// SAVE CHECKPOINT
// ============================================

/**
 * Saves a checkpoint of the current pipeline state to enable recovery
 * @param ctx Pipeline context
 * @param completedStep The step that was just completed
 * @returns SaveCheckpointResult
 */
export async function saveCheckpoint(
  ctx: PipelineContext,
  completedStep: JobStatus
): Promise<SaveCheckpointResult> {
  const supabase = createAdminSupabase();

  const checkpointData: CheckpointState = {
    lastCompletedStep: completedStep,
    artifacts: ctx.artifacts,
    savedAt: new Date().toISOString(),
    progress: ctx.job.progress,
  };

  try {
    // Save checkpoint to database
    const { error } = await supabase
      .from("jobs")
      .update({
        checkpoint_state: checkpointData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ctx.jobId);

    if (error) {
      console.error(`[Recovery] Failed to save checkpoint: ${error.message}`);
      throw error;
    }

    await insertJobEvent(ctx.jobId, completedStep, "Checkpoint saved");

    console.log(`[Recovery] Checkpoint saved for job ${ctx.jobId} after ${completedStep}`);

    return {
      success: true,
      lastCompletedStep: completedStep,
      checkpointData,
    };
  } catch (error) {
    console.error(`[Recovery] Error saving checkpoint:`, error);
    return {
      success: false,
      lastCompletedStep: completedStep,
      checkpointData,
    };
  }
}

// ============================================
// LOAD CHECKPOINT
// ============================================

/**
 * Loads checkpoint state from database
 * @param jobId Job ID
 * @returns CheckpointState or null if no checkpoint exists
 */
export async function loadCheckpoint(jobId: string): Promise<CheckpointState | null> {
  const supabase = createAdminSupabase();

  try {
    const { data, error } = await supabase
      .from("jobs")
      .select("checkpoint_state")
      .eq("id", jobId)
      .single();

    if (error || !data || !data.checkpoint_state) {
      return null;
    }

    return data.checkpoint_state as CheckpointState;
  } catch (error) {
    console.error(`[Recovery] Error loading checkpoint:`, error);
    return null;
  }
}

// ============================================
// CAN RETRY FROM CHECKPOINT
// ============================================

/**
 * Determines if a job can be retried from a checkpoint
 * @param checkpoint Checkpoint state
 * @returns true if retry is possible from checkpoint
 */
export function canRetryFromCheckpoint(checkpoint: CheckpointState | null): boolean {
  if (!checkpoint) {
    return false;
  }

  const thresholdIndex = PIPELINE_STEPS.indexOf(CHECKPOINT_THRESHOLD_STEP);
  const checkpointIndex = PIPELINE_STEPS.indexOf(checkpoint.lastCompletedStep);

  // Can only retry if checkpoint is at or after the threshold
  return checkpointIndex >= thresholdIndex;
}

// ============================================
// GET RETRY OPTIONS
// ============================================

/**
 * Gets available retry options based on checkpoint state
 * @param checkpoint Checkpoint state
 * @returns RetryOptions
 */
export function getRetryOptions(checkpoint: CheckpointState | null): RetryOptions {
  if (!canRetryFromCheckpoint(checkpoint)) {
    return {
      canRetryFromCheckpoint: false,
      message: "This job requires a full retry from the beginning. No checkpoint is available for partial recovery.",
    };
  }

  const lastStep = checkpoint!.lastCompletedStep;
  const lastStepIndex = PIPELINE_STEPS.indexOf(lastStep);
  const nextStepIndex = lastStepIndex + 1;
  const nextStep = PIPELINE_STEPS[nextStepIndex] as JobStatus;

  let message = "";
  let artifactInfo = "";

  // Build user-friendly message about what was saved
  if (checkpoint!.artifacts.imagePaths && checkpoint!.artifacts.imagePaths.length > 0) {
    artifactInfo = `${checkpoint!.artifacts.imagePaths.length} images were generated successfully`;
  }

  if (checkpoint!.artifacts.narrationPath) {
    if (artifactInfo) {
      artifactInfo += " and ";
    }
    artifactInfo += "voice narration was created";
  }

  message = `Your video can be retried from the ${nextStep} step. ${artifactInfo}. You won't be charged again for the completed steps.`;

  return {
    canRetryFromCheckpoint: true,
    nextStep,
    message,
  };
}

// ============================================
// GET NEXT STEP FROM CHECKPOINT
// ============================================

/**
 * Determines the next step to execute based on checkpoint
 * @param checkpoint Checkpoint state
 * @returns Next step to execute, or null if job is complete
 */
export function getNextStepFromCheckpoint(checkpoint: CheckpointState | null): JobStatus | null {
  if (!checkpoint) {
    return "SCRIPTING"; // Start from the beginning
  }

  const lastStepIndex = PIPELINE_STEPS.indexOf(checkpoint.lastCompletedStep);
  const nextStepIndex = lastStepIndex + 1;

  if (nextStepIndex >= PIPELINE_STEPS.length) {
    return null; // Job is complete
  }

  return PIPELINE_STEPS[nextStepIndex] as JobStatus;
}

// ============================================
// CLEAR CHECKPOINT
// ============================================

/**
 * Clears checkpoint state (called after successful job completion)
 * @param jobId Job ID
 */
export async function clearCheckpoint(jobId: string): Promise<void> {
  const supabase = createAdminSupabase();

  try {
    await supabase
      .from("jobs")
      .update({ checkpoint_state: null })
      .eq("id", jobId);

    console.log(`[Recovery] Checkpoint cleared for job ${jobId}`);
  } catch (error) {
    console.error(`[Recovery] Error clearing checkpoint:`, error);
  }
}
