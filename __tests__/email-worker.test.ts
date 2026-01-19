/**
 * Email Worker Tests
 *
 * Tests for the BullMQ email worker processor
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Queue } from 'bullmq';

describe('Email Worker', () => {
  let createEmailWorker: any;
  let closeEmailWorker: any;
  let createEmailQueue: any;
  let closeEmailQueue: any;
  let queue: Queue;

  beforeEach(async () => {
    // Clean up any existing worker and queue
    if (closeEmailWorker) {
      await closeEmailWorker();
    }
    if (closeEmailQueue) {
      await closeEmailQueue();
    }
  });

  afterEach(async () => {
    // Clean up after each test
    if (closeEmailWorker) {
      await closeEmailWorker();
    }
    if (closeEmailQueue) {
      await closeEmailQueue();
    }
  });

  it('should create email worker with default configuration', async () => {
    const emailWorkerModule = await import('../apps/worker/src/queues/email-worker');
    createEmailWorker = emailWorkerModule.createEmailWorker;
    closeEmailWorker = emailWorkerModule.closeEmailWorker;

    const worker = createEmailWorker();

    expect(worker).toBeDefined();
    expect(worker.name).toBe('emails');

    await closeEmailWorker();
  });

  it('should process email jobs', async () => {
    const emailQueueModule = await import('../apps/worker/src/queues/email');
    createEmailQueue = emailQueueModule.createEmailQueue;
    closeEmailQueue = emailQueueModule.closeEmailQueue;

    const emailWorkerModule = await import('../apps/worker/src/queues/email-worker');
    createEmailWorker = emailWorkerModule.createEmailWorker;
    closeEmailWorker = emailWorkerModule.closeEmailWorker;

    // Create queue and worker
    queue = createEmailQueue();
    const worker = createEmailWorker();

    // Add a test job
    const job = await queue.add('send', {
      to: 'test@example.com',
      subject: 'Test Email',
      template: 'test-template',
      data: { name: 'Test User' },
    });

    // Wait for the job to be processed (with timeout)
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Clean up
    await closeEmailWorker();
    await closeEmailQueue();
  });

  it('should handle worker configuration', async () => {
    const emailWorkerModule = await import('../apps/worker/src/queues/email-worker');
    createEmailWorker = emailWorkerModule.createEmailWorker;
    closeEmailWorker = emailWorkerModule.closeEmailWorker;

    const worker = createEmailWorker({
      concurrency: 3,
      limiter: {
        max: 50,
        duration: 60000,
      },
    });

    expect(worker).toBeDefined();
    expect(worker.opts.concurrency).toBe(3);
    expect(worker.opts.limiter).toEqual({
      max: 50,
      duration: 60000,
    });

    await closeEmailWorker();
  });

  it('should return singleton worker instance', async () => {
    const emailWorkerModule = await import('../apps/worker/src/queues/email-worker');
    createEmailWorker = emailWorkerModule.createEmailWorker;
    closeEmailWorker = emailWorkerModule.closeEmailWorker;

    const worker1 = createEmailWorker();
    const worker2 = createEmailWorker();

    expect(worker1).toBe(worker2);

    await closeEmailWorker();
  });
});
