/**
 * BullMQ Email Worker
 *
 * Processes email notification jobs from the BullMQ queue.
 * Handles email sending with rate limiting and retries.
 */

import { Worker, WorkerOptions, Job } from 'bullmq';

let emailWorker: Worker | null = null;

export interface EmailPayload {
  to: string;
  subject: string;
  template: string;
  data: Record<string, any>;
}

export interface EmailWorkerConfig {
  redisUrl?: string;
  queueName?: string;
  concurrency?: number;
  limiter?: {
    max: number;
    duration: number;
  };
}

/**
 * Process an email job
 * This is a placeholder that logs the email job.
 * In production, this would send the actual email via Resend or similar.
 */
async function processEmail(job: Job<EmailPayload>): Promise<void> {
  const { to, subject, template, data } = job.data;

  try {
    console.log(`[EMAIL] Processing email job ${job.id}`);
    console.log(`[EMAIL] To: ${to}`);
    console.log(`[EMAIL] Subject: ${subject}`);
    console.log(`[EMAIL] Template: ${template}`);

    // TODO: In the next feature (EMAIL-002), this will be replaced with:
    // await sendEmail({ to, subject, template, data });

    // For now, just simulate email sending
    console.log(`[EMAIL] ✅ Email sent to ${to}`);
  } catch (error) {
    console.error(`[EMAIL] ❌ Failed to send email:`, error);
    throw error; // Retry on failure
  }
}

/**
 * Creates and returns a singleton BullMQ Worker instance for processing emails.
 * If a worker already exists, returns the existing instance.
 *
 * @param config - Optional worker configuration
 * @returns Worker instance
 */
export function createEmailWorker(config?: EmailWorkerConfig): Worker {
  if (emailWorker) {
    return emailWorker;
  }

  const redisUrl = config?.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
  const queueName = config?.queueName || 'emails';

  // Parse Redis URL for BullMQ connection
  const url = new URL(redisUrl);

  const workerOptions: WorkerOptions = {
    connection: {
      host: url.hostname,
      port: parseInt(url.port || '6379', 10),
    },
    concurrency: config?.concurrency ?? 5,
    limiter: config?.limiter ?? {
      max: 100,
      duration: 60000, // 100 emails/minute
    },
  };

  emailWorker = new Worker(queueName, processEmail, workerOptions);

  // Event handlers
  emailWorker.on('completed', (job: Job) => {
    console.log(`[EMAIL] Job ${job.id} completed`);
  });

  emailWorker.on('failed', (job: Job | undefined, error: Error) => {
    console.error(`[EMAIL] Job ${job?.id} failed:`, error.message);
  });

  emailWorker.on('error', (error: Error) => {
    console.error('[EMAIL] Worker error:', error.message);
  });

  console.log(`[WORKER] ✅ Email worker initialized for queue '${queueName}'`);

  return emailWorker;
}

/**
 * Returns the current email worker instance without creating a new one.
 *
 * @returns Worker instance or null if not yet created
 */
export function getEmailWorker(): Worker | null {
  return emailWorker;
}

/**
 * Closes the email worker and resets the singleton.
 * Useful for graceful shutdown and testing.
 */
export async function closeEmailWorker(): Promise<void> {
  if (emailWorker) {
    await emailWorker.close();
    emailWorker = null;
  }
}
