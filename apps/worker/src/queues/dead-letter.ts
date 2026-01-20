/**
 * RESIL-003: Dead Letter Queue
 *
 * Jobs that fail 3+ times get flagged for manual review.
 * This module provides functionality to:
 * - Check if a job should be moved to DLQ based on retry count
 * - Move jobs to the dead letter queue
 * - Retrieve jobs in the DLQ for admin review
 * - Retry jobs from the DLQ
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// Constants
const MAX_RETRY_COUNT = 3;

/**
 * Determines if a job should be moved to the dead letter queue
 * based on its retry count
 */
export function shouldMoveToDeadLetterQueue(retryCount: number): boolean {
  return retryCount >= MAX_RETRY_COUNT;
}

/**
 * Moves a job to the dead letter queue by updating its status
 * and setting DLQ timestamp and reason
 */
export async function moveJobToDeadLetterQueue(
  supabase: SupabaseClient,
  jobId: string,
  reason: string
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('jobs')
    .update({
      status: 'FAILED',
      dlq_at: now,
      dlq_reason: reason,
      finished_at: now,
    })
    .eq('id', jobId);

  if (error) {
    console.error('Failed to move job to DLQ:', error.message);
    throw error;
  }

  console.log(`[DLQ] Moved job ${jobId} to dead letter queue: ${reason}`);
}

/**
 * Retrieves all jobs in the dead letter queue
 * (jobs with dlq_at not null)
 */
export async function getDeadLetterQueueJobs(
  supabase: SupabaseClient
): Promise<any[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .not('dlq_at', 'is', null)
    .order('dlq_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch DLQ jobs:', error.message);
    throw error;
  }

  return data || [];
}

/**
 * Retries a job from the dead letter queue by resetting its status
 * and clearing DLQ-related fields
 */
export async function retryJobFromDeadLetterQueue(
  supabase: SupabaseClient,
  jobId: string
): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .update({
      status: 'PENDING',
      retry_count: 0,
      dlq_at: null,
      dlq_reason: null,
      error_code: null,
      error_message: null,
      started_at: null,
      finished_at: null,
    })
    .eq('id', jobId);

  if (error) {
    console.error('Failed to retry job from DLQ:', error.message);
    throw error;
  }

  console.log(`[DLQ] Retrying job ${jobId} from dead letter queue`);
}
