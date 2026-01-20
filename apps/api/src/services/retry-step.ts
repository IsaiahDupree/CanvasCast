/**
 * Service for retrying individual pipeline steps
 * Feature RESIL-004: User Self-Service Retry
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { JobStatus } from '@canvascast/shared';

// Steps that can be retried individually (after checkpoint threshold)
const RETRIABLE_STEPS: JobStatus[] = [
  'IMAGE_GEN',
  'TIMELINE_BUILD',
  'RENDERING',
  'PACKAGING',
];

// Checkpoint threshold - only allow retry from IMAGE_GEN onwards
const CHECKPOINT_THRESHOLD_STEP = 'IMAGE_GEN';

export interface RetryStepOptions {
  jobId: string;
  stepName: JobStatus;
  userId: string;
}

export interface RetryStepResult {
  success: boolean;
  message?: string;
  stepName?: JobStatus;
  newStatus?: JobStatus;
  checkpointPreserved?: boolean;
  error?: string;
}

/**
 * Validates if a step can be retried individually
 */
export function canRetryStep(stepName: JobStatus): boolean {
  return RETRIABLE_STEPS.includes(stepName);
}

/**
 * Retries a specific pipeline step for a job
 */
export async function retryStep(
  supabase: SupabaseClient,
  options: RetryStepOptions
): Promise<RetryStepResult> {
  const { jobId, stepName, userId } = options;

  // Validate step can be retried
  if (!canRetryStep(stepName)) {
    return {
      success: false,
      error: `Step "${stepName}" cannot be retried individually. Only steps after ${CHECKPOINT_THRESHOLD_STEP} can be retried.`,
    };
  }

  try {
    // Fetch job to verify ownership and state
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();

    if (jobError || !job) {
      return {
        success: false,
        error: 'Job not found',
      };
    }

    // Check if job is in a retriable state
    if (job.status !== 'FAILED') {
      return {
        success: false,
        error: `Job must be in FAILED status to retry a step. Current status: ${job.status}`,
      };
    }

    // Verify checkpoint exists (should have artifacts from previous steps)
    if (!job.checkpoint_state) {
      return {
        success: false,
        error: 'No checkpoint state found. Cannot retry individual step without checkpoint.',
      };
    }

    // Update job to retry the specific step
    // Set status to the step we want to retry
    const { error: updateError } = await supabase
      .from('jobs')
      .update({
        status: stepName,
        progress: calculateProgressForStep(stepName),
        error_code: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (updateError) {
      console.error('[RetryStep] Failed to update job:', updateError);
      return {
        success: false,
        error: 'Failed to update job status for retry',
      };
    }

    // Update job_steps table to mark the step as pending retry
    const { error: stepError } = await supabase
      .from('job_steps')
      .update({
        state: 'PENDING',
        error_code: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('job_id', jobId)
      .eq('step_name', stepName);

    if (stepError) {
      console.warn('[RetryStep] Failed to update job_steps:', stepError);
      // Don't fail the whole operation if this fails
    }

    console.log(`[RetryStep] Job ${jobId} step ${stepName} marked for retry`);

    return {
      success: true,
      message: `Step retry initiated for ${stepName}`,
      stepName,
      newStatus: stepName,
      checkpointPreserved: true,
    };
  } catch (error) {
    console.error('[RetryStep] Error:', error);
    return {
      success: false,
      error: 'Internal error during step retry',
    };
  }
}

/**
 * Calculate progress percentage for a given step
 */
function calculateProgressForStep(step: JobStatus): number {
  const stepProgress: Record<string, number> = {
    QUEUED: 0,
    PENDING: 0,
    SCRIPTING: 10,
    VOICE_GEN: 20,
    ALIGNMENT: 30,
    VISUAL_PLAN: 40,
    IMAGE_GEN: 50,
    TIMELINE_BUILD: 70,
    RENDERING: 80,
    PACKAGING: 90,
    READY: 100,
    FAILED: 0,
  };

  return stepProgress[step] || 0;
}
