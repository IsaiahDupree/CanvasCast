/**
 * Notification Service (MOD-004, EMAIL-*)
 *
 * Handles queueing email notifications for various events.
 * This service queues notifications to be processed asynchronously by the worker.
 */

import { Queue } from 'bullmq';
import { createEmailQueue } from '../../../worker/src/queues/email.js';

let notificationQueue: Queue | null = null;

/**
 * Initialize the notification queue
 */
export function initializeNotificationQueue() {
  if (!notificationQueue) {
    notificationQueue = createEmailQueue();
  }
  return notificationQueue;
}

/**
 * Queue an appeal decision notification email
 *
 * @param userId - The user who submitted the appeal
 * @param userEmail - The user's email address
 * @param appealId - The appeal ID
 * @param decision - 'approved' or 'denied'
 * @param resolutionNotes - Admin's explanation
 * @param originalContent - The content that was appealed
 */
export async function queueAppealDecisionEmail(
  userId: string,
  userEmail: string,
  appealId: string,
  decision: 'approved' | 'denied',
  resolutionNotes: string,
  originalContent: string
): Promise<void> {
  try {
    const queue = notificationQueue || initializeNotificationQueue();

    await queue.add('appeal-decision', {
      type: 'appeal_decision',
      userId,
      userEmail,
      appealId,
      decision,
      resolutionNotes,
      originalContent,
      timestamp: new Date().toISOString(),
    });

    console.log(`[NOTIFICATIONS] Queued appeal decision email for user ${userId}`);
  } catch (error) {
    console.error('[NOTIFICATIONS] Error queueing appeal decision email:', error);
    // Don't throw - email notification failure shouldn't break the appeal resolution
  }
}

/**
 * Queue a job completion email
 *
 * @param userId - The user who created the job
 * @param userEmail - The user's email address
 * @param jobId - The job ID
 * @param projectTitle - The project title
 * @param videoUrl - URL to the completed video
 */
export async function queueJobCompletionEmail(
  userId: string,
  userEmail: string,
  jobId: string,
  projectTitle: string,
  videoUrl: string
): Promise<void> {
  try {
    const queue = notificationQueue || initializeNotificationQueue();

    await queue.add('job-complete', {
      type: 'job_complete',
      userId,
      userEmail,
      jobId,
      projectTitle,
      videoUrl,
      timestamp: new Date().toISOString(),
    });

    console.log(`[NOTIFICATIONS] Queued job completion email for user ${userId}`);
  } catch (error) {
    console.error('[NOTIFICATIONS] Error queueing job completion email:', error);
  }
}

/**
 * Queue a job failed email
 *
 * @param userId - The user who created the job
 * @param userEmail - The user's email address
 * @param jobId - The job ID
 * @param projectTitle - The project title
 * @param errorMessage - The error message
 * @param creditsRefunded - Whether credits were refunded
 */
export async function queueJobFailedEmail(
  userId: string,
  userEmail: string,
  jobId: string,
  projectTitle: string,
  errorMessage: string,
  creditsRefunded: boolean
): Promise<void> {
  try {
    const queue = notificationQueue || initializeNotificationQueue();

    await queue.add('job-failed', {
      type: 'job_failed',
      userId,
      userEmail,
      jobId,
      projectTitle,
      errorMessage,
      creditsRefunded,
      timestamp: new Date().toISOString(),
    });

    console.log(`[NOTIFICATIONS] Queued job failed email for user ${userId}`);
  } catch (error) {
    console.error('[NOTIFICATIONS] Error queueing job failed email:', error);
  }
}

/**
 * Close the notification queue
 */
export async function closeNotificationQueue(): Promise<void> {
  if (notificationQueue) {
    await notificationQueue.close();
    notificationQueue = null;
  }
}
