/**
 * Email Queue Tests
 *
 * Tests for the BullMQ email queue setup and configuration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Email Queue', () => {
  let createEmailQueue: any;
  let getEmailQueue: any;
  let closeEmailQueue: any;

  beforeEach(async () => {
    // Clean up any existing queue
    if (closeEmailQueue) {
      await closeEmailQueue();
    }
  });

  afterEach(async () => {
    // Clean up after each test
    if (closeEmailQueue) {
      await closeEmailQueue();
    }
  });

  it('should create email queue with default configuration', async () => {
    // Import the functions (this will fail until we implement them)
    const emailQueue = await import('../apps/worker/src/queues/email');
    createEmailQueue = emailQueue.createEmailQueue;
    getEmailQueue = emailQueue.getEmailQueue;
    closeEmailQueue = emailQueue.closeEmailQueue;

    const queue = createEmailQueue();

    expect(queue).toBeDefined();
    expect(queue.name).toBe('emails');

    await closeEmailQueue();
  });

  it('should create email queue with custom configuration', async () => {
    const emailQueue = await import('../apps/worker/src/queues/email');
    createEmailQueue = emailQueue.createEmailQueue;
    getEmailQueue = emailQueue.getEmailQueue;
    closeEmailQueue = emailQueue.closeEmailQueue;

    const queue = createEmailQueue({
      queueName: 'custom-emails',
      redisUrl: 'redis://localhost:6379',
    });

    expect(queue).toBeDefined();
    expect(queue.name).toBe('custom-emails');

    await closeEmailQueue();
  });

  it('should return singleton instance', async () => {
    const emailQueue = await import('../apps/worker/src/queues/email');
    createEmailQueue = emailQueue.createEmailQueue;
    getEmailQueue = emailQueue.getEmailQueue;
    closeEmailQueue = emailQueue.closeEmailQueue;

    const queue1 = createEmailQueue();
    const queue2 = createEmailQueue();

    expect(queue1).toBe(queue2);

    await closeEmailQueue();
  });

  it('should get existing queue instance', async () => {
    const emailQueue = await import('../apps/worker/src/queues/email');
    createEmailQueue = emailQueue.createEmailQueue;
    getEmailQueue = emailQueue.getEmailQueue;
    closeEmailQueue = emailQueue.closeEmailQueue;

    const queue = createEmailQueue();
    const retrieved = getEmailQueue();

    expect(retrieved).toBe(queue);

    await closeEmailQueue();
  });

  it('should return null when queue not created', async () => {
    const emailQueue = await import('../apps/worker/src/queues/email');
    getEmailQueue = emailQueue.getEmailQueue;

    const retrieved = getEmailQueue();

    expect(retrieved).toBeNull();
  });

  it('should close queue and reset singleton', async () => {
    const emailQueue = await import('../apps/worker/src/queues/email');
    createEmailQueue = emailQueue.createEmailQueue;
    getEmailQueue = emailQueue.getEmailQueue;
    closeEmailQueue = emailQueue.closeEmailQueue;

    createEmailQueue();
    await closeEmailQueue();

    const retrieved = getEmailQueue();
    expect(retrieved).toBeNull();
  });

  it('should have correct default job options', async () => {
    const emailQueue = await import('../apps/worker/src/queues/email');
    createEmailQueue = emailQueue.createEmailQueue;
    closeEmailQueue = emailQueue.closeEmailQueue;

    const queue = createEmailQueue();

    // Check default options are set correctly
    expect(queue.opts.defaultJobOptions?.attempts).toBe(3);
    expect(queue.opts.defaultJobOptions?.backoff).toEqual({
      type: 'exponential',
      delay: 5000,
    });
    expect(queue.opts.defaultJobOptions?.removeOnComplete).toBe(100);

    await closeEmailQueue();
  });
});
