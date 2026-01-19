/**
 * BullMQ Job Queue Setup
 *
 * Provides a singleton BullMQ queue instance for video generation jobs.
 * Handles queue configuration and connection management.
 */

import { Queue, QueueOptions } from 'bullmq';

let jobQueue: Queue | null = null;

export interface JobQueueConfig {
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
 * Creates and returns a singleton BullMQ Queue instance.
 * If a queue already exists, returns the existing instance.
 *
 * @param config - Optional queue configuration
 * @returns Queue instance
 */
export function createJobQueue(config?: JobQueueConfig): Queue {
  if (jobQueue) {
    return jobQueue;
  }

  const redisUrl = config?.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
  const queueName = config?.queueName || 'video-generation';

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

  jobQueue = new Queue(queueName, queueOptions);
  console.log(`[QUEUE] ✅ Job queue '${queueName}' initialized`);

  return jobQueue;
}

/**
 * Returns the current job queue instance without creating a new one.
 *
 * @returns Queue instance or null if not yet created
 */
export function getJobQueue(): Queue | null {
  return jobQueue;
}

/**
 * Closes the job queue and resets the singleton.
 * Useful for graceful shutdown and testing.
 */
export async function closeJobQueue(): Promise<void> {
  if (jobQueue) {
    await jobQueue.close();
    jobQueue = null;
  }
}
