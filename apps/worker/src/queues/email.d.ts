/**
 * BullMQ Email Queue Setup
 *
 * Provides a singleton BullMQ queue instance for email notifications.
 * Handles queue configuration and connection management.
 */
import { Queue } from 'bullmq';
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
export declare function createEmailQueue(config?: EmailQueueConfig): Queue;
/**
 * Returns the current email queue instance without creating a new one.
 *
 * @returns Queue instance or null if not yet created
 */
export declare function getEmailQueue(): Queue | null;
/**
 * Closes the email queue and resets the singleton.
 * Useful for graceful shutdown and testing.
 */
export declare function closeEmailQueue(): Promise<void>;
