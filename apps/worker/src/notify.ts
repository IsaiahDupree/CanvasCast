/**
 * Notification Service
 *
 * Provides functions to queue email notifications by type.
 * Handles user lookup from Supabase and delegates email sending to BullMQ queue.
 *
 * Features:
 * - Queue welcome emails for new users
 * - Queue job completion notifications
 * - Queue job failure notifications
 * - Queue purchase confirmation emails
 * - Automatic user lookup for email addresses
 *
 * PRD: docs/prds/11-email-notifications.md
 * Feature: EMAIL-007
 */

import { Queue } from 'bullmq';
import { createAdminSupabase } from './lib/supabase';

/**
 * Result type for notification operations
 */
export interface NotifyResult {
  success: boolean;
  error?: string;
  jobId?: string;
}

/**
 * User data retrieved from Supabase
 */
interface UserData {
  id: string;
  email: string;
  name?: string;
}

/**
 * Fetches user data from Supabase auth
 */
async function getUserData(userId: string): Promise<UserData | null> {
  const supabase = createAdminSupabase();

  const { data, error } = await supabase.auth.admin.getUserById(userId);

  if (error || !data.user) {
    console.error('[Notify] Failed to fetch user:', error?.message);
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email || '',
    name: data.user.user_metadata?.name || data.user.user_metadata?.full_name || '',
  };
}

/**
 * Validates required parameters
 */
function validateParams(params: Record<string, any>): void {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      throw new Error(`Missing required parameter: ${key}`);
    }
  }
}

/**
 * Send welcome email to new user
 */
export async function sendWelcomeEmail(
  emailQueue: Queue,
  userId: string
): Promise<NotifyResult> {
  try {
    validateParams({ userId });

    const userData = await getUserData(userId);
    if (!userData) {
      return {
        success: false,
        error: 'User not found',
      };
    }

    const job = await emailQueue.add('welcome', {
      userId: userData.id,
      userEmail: userData.email,
      userName: userData.name || 'there',
    });

    console.log(`[Notify] Welcome email queued for user ${userId}, job ${job.id}`);

    return {
      success: true,
      jobId: job.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Notify] Failed to queue welcome email:', message);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Parameters for job complete email
 */
export interface JobCompleteEmailParams {
  userId: string;
  jobId: string;
  projectId: string;
  projectTitle: string;
  duration: string;
  credits: number;
  downloadUrl: string;
}

/**
 * Send job complete email
 */
export async function sendJobCompleteEmail(
  emailQueue: Queue,
  params: JobCompleteEmailParams
): Promise<NotifyResult> {
  try {
    validateParams({
      userId: params.userId,
      jobId: params.jobId,
      projectId: params.projectId,
      projectTitle: params.projectTitle,
      duration: params.duration,
      downloadUrl: params.downloadUrl,
    });

    const userData = await getUserData(params.userId);
    if (!userData) {
      return {
        success: false,
        error: 'User not found',
      };
    }

    const job = await emailQueue.add('job-complete', {
      userId: userData.id,
      userEmail: userData.email,
      userName: userData.name || 'there',
      jobId: params.jobId,
      projectId: params.projectId,
      projectTitle: params.projectTitle,
      duration: params.duration,
      credits: params.credits,
      downloadUrl: params.downloadUrl,
      dashboardUrl: `${process.env.APP_URL || 'https://canvascast.ai'}/app`,
    });

    console.log(`[Notify] Job complete email queued for job ${params.jobId}, job ${job.id}`);

    return {
      success: true,
      jobId: job.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Notify] Failed to queue job complete email:', message);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Parameters for job failed email
 */
export interface JobFailedEmailParams {
  userId: string;
  jobId: string;
  projectId: string;
  projectTitle: string;
  errorMessage: string;
  creditsRefunded: number;
}

/**
 * Send job failed email
 */
export async function sendJobFailedEmail(
  emailQueue: Queue,
  params: JobFailedEmailParams
): Promise<NotifyResult> {
  try {
    validateParams({
      userId: params.userId,
      jobId: params.jobId,
      projectId: params.projectId,
      projectTitle: params.projectTitle,
      errorMessage: params.errorMessage,
    });

    const userData = await getUserData(params.userId);
    if (!userData) {
      return {
        success: false,
        error: 'User not found',
      };
    }

    const job = await emailQueue.add('job-failed', {
      userId: userData.id,
      userEmail: userData.email,
      userName: userData.name || 'there',
      jobId: params.jobId,
      projectId: params.projectId,
      projectTitle: params.projectTitle,
      errorMessage: params.errorMessage,
      creditsRefunded: params.creditsRefunded,
      dashboardUrl: `${process.env.APP_URL || 'https://canvascast.ai'}/app`,
    });

    console.log(`[Notify] Job failed email queued for job ${params.jobId}, job ${job.id}`);

    return {
      success: true,
      jobId: job.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Notify] Failed to queue job failed email:', message);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Parameters for purchase confirmation email
 */
export interface PurchaseConfirmationEmailParams {
  userId: string;
  creditsAdded: number;
  amount: number;
  receiptUrl?: string;
}

/**
 * Send purchase confirmation email
 */
export async function sendPurchaseConfirmationEmail(
  emailQueue: Queue,
  params: PurchaseConfirmationEmailParams
): Promise<NotifyResult> {
  try {
    validateParams({
      userId: params.userId,
      creditsAdded: params.creditsAdded,
      amount: params.amount,
    });

    const userData = await getUserData(params.userId);
    if (!userData) {
      return {
        success: false,
        error: 'User not found',
      };
    }

    const job = await emailQueue.add('purchase-confirmation', {
      userId: userData.id,
      userEmail: userData.email,
      userName: userData.name || 'there',
      creditsAdded: params.creditsAdded,
      amount: params.amount,
      receiptUrl: params.receiptUrl,
      dashboardUrl: `${process.env.APP_URL || 'https://canvascast.ai'}/app`,
    });

    console.log(`[Notify] Purchase confirmation email queued for user ${params.userId}, job ${job.id}`);

    return {
      success: true,
      jobId: job.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Notify] Failed to queue purchase confirmation email:', message);
    return {
      success: false,
      error: message,
    };
  }
}
