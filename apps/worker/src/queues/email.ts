/**
 * BullMQ Email Queue Setup
 *
 * Provides a singleton BullMQ queue instance for email notifications.
 * Handles queue configuration and connection management.
 */

import { Queue, QueueOptions } from 'bullmq';

let emailQueue: Queue | null = null;

export interface EmailQueueConfig {
  redisUrl?: string;
  queueName?: string;
  defaultJobOptions?: {
    attempts?: number;
    backoff?: {
      type: string;
      delay: number;
    };
    removeOnComplete?: number | boolean;
    removeOnFail?: number | boolean;
  };
}

/**
 * Creates and returns a singleton BullMQ Queue instance for emails.
 * If a queue already exists, returns the existing instance.
 *
 * @param config - Optional queue configuration
 * @returns Queue instance
 */
export function createEmailQueue(config?: EmailQueueConfig): Queue {
  if (emailQueue) {
    return emailQueue;
  }

  const redisUrl = config?.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
  const queueName = config?.queueName || 'emails';

  // Parse Redis URL for BullMQ connection
  const url = new URL(redisUrl);

  const queueOptions: QueueOptions = {
    connection: {
      host: url.hostname,
      port: parseInt(url.port || '6379', 10),
    },
    defaultJobOptions: {
      attempts: config?.defaultJobOptions?.attempts ?? 3,
      backoff: config?.defaultJobOptions?.backoff ?? {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: config?.defaultJobOptions?.removeOnComplete ?? 100,
      removeOnFail: config?.defaultJobOptions?.removeOnFail ?? 50,
    },
  };

  emailQueue = new Queue(queueName, queueOptions);
  console.log(`[QUEUE] ✅ Email queue '${queueName}' initialized`);

  return emailQueue;
}

/**
 * Returns the current email queue instance without creating a new one.
 *
 * @returns Queue instance or null if not yet created
 */
export function getEmailQueue(): Queue | null {
  return emailQueue;
}

/**
 * Closes the email queue and resets the singleton.
 * Useful for graceful shutdown and testing.
 */
export async function closeEmailQueue(): Promise<void> {
  if (emailQueue) {
    await emailQueue.close();
    emailQueue = null;
  }
}
