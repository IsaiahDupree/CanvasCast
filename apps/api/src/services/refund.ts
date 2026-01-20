/**
 * RESIL-002: Credit Refund Policy
 *
 * Service for determining automatic credit refunds based on job completion threshold.
 *
 * Refund Policy:
 * - Jobs that fail before 30% completion receive FULL refunds
 * - Jobs that fail after 30% completion receive NO refunds (significant work done)
 *
 * Rationale:
 * - Early failure (< 30%): Only script generation, minimal API costs
 * - Late failure (>= 30%): TTS, Whisper, and/or image generation incurred
 */

import { REFUND_THRESHOLD_PROGRESS } from "@canvascast/shared";
import type { JobStatus } from "@canvascast/shared";

/**
 * Determines if a job should receive a credit refund based on progress
 *
 * @param status - Current job status when failed
 * @param progress - Progress percentage (0-100) when failed
 * @returns true if credits should be refunded, false otherwise
 */
export function shouldRefundCredits(status: JobStatus, progress: number): boolean {
  return progress < REFUND_THRESHOLD_PROGRESS;
}

/**
 * Calculates the refund amount based on reserved credits and progress
 *
 * @param reservedCredits - Amount of credits reserved for the job
 * @param status - Current job status when failed
 * @param progress - Progress percentage (0-100) when failed
 * @returns Amount of credits to refund (0 or full reserved amount)
 */
export function calculateRefundAmount(
  reservedCredits: number,
  status: JobStatus,
  progress: number
): number {
  if (reservedCredits === 0) {
    return 0;
  }

  return shouldRefundCredits(status, progress) ? reservedCredits : 0;
}
