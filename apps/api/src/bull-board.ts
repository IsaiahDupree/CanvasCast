/**
 * Bull Board Dashboard Setup
 *
 * Provides a web UI for monitoring BullMQ job queues.
 * Displays queue statistics, job details, and allows job management.
 */

import { createBullBoard as createBullBoardUI } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';

export const BULL_BOARD_PATH = '/admin/queues';

/**
 * Creates and configures the Bull Board dashboard
 *
 * @param queues - Array of BullMQ Queue instances to monitor
 * @returns Express adapter with configured dashboard routes
 */
export function createBullBoard(queues: Queue[]): ExpressAdapter {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(BULL_BOARD_PATH);

  createBullBoardUI({
    queues: queues.map((queue) => new BullMQAdapter(queue)),
    serverAdapter,
  });

  return serverAdapter;
}
