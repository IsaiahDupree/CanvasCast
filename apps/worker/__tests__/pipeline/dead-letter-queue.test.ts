/**
 * Tests for RESIL-003: Dead Letter Queue
 * Jobs that fail 3+ times get flagged for manual review
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { JobRow } from '../../src/pipeline/types';
import {
  shouldMoveToDeadLetterQueue,
  moveJobToDeadLetterQueue,
  getDeadLetterQueueJobs,
  retryJobFromDeadLetterQueue,
} from '../../src/queues/dead-letter';

describe('Dead Letter Queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('shouldMoveToDeadLetterQueue', () => {
    it('should return false for jobs with retry_count < 3', () => {
      expect(shouldMoveToDeadLetterQueue(0)).toBe(false);
      expect(shouldMoveToDeadLetterQueue(1)).toBe(false);
      expect(shouldMoveToDeadLetterQueue(2)).toBe(false);
    });

    it('should return true for jobs with retry_count >= 3', () => {
      expect(shouldMoveToDeadLetterQueue(3)).toBe(true);
      expect(shouldMoveToDeadLetterQueue(4)).toBe(true);
      expect(shouldMoveToDeadLetterQueue(10)).toBe(true);
    });
  });

  describe('moveJobToDeadLetterQueue', () => {
    it('should update job status to FAILED and set dlq_at timestamp', async () => {
      const jobId = 'test-job-id';
      const reason = 'Exceeded maximum retry attempts';

      const mockUpdate = vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: { id: jobId }, error: null })),
      }));

      const mockFrom = vi.fn(() => ({
        update: mockUpdate,
      }));

      const supabase = { from: mockFrom };

      await moveJobToDeadLetterQueue(supabase as any, jobId, reason);

      expect(mockFrom).toHaveBeenCalledWith('jobs');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'FAILED',
          dlq_at: expect.any(String),
          dlq_reason: reason,
        })
      );
    });

    it('should log error if job update fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const jobId = 'test-job-id';

      const mockUpdate = vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({
          data: null,
          error: { message: 'Database error' }
        })),
      }));

      const mockFrom = vi.fn(() => ({
        update: mockUpdate,
      }));

      const supabase = { from: mockFrom };

      await expect(moveJobToDeadLetterQueue(supabase as any, jobId, 'Test reason')).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to move job to DLQ'),
        expect.any(String)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getDeadLetterQueueJobs', () => {
    it('should fetch jobs with dlq_at not null', async () => {
      const mockJobs = [
        { id: 'job-1', dlq_at: '2026-01-20T00:00:00Z', retry_count: 3 },
        { id: 'job-2', dlq_at: '2026-01-20T01:00:00Z', retry_count: 5 },
      ];

      const mockOrder = vi.fn(() => Promise.resolve({
        data: mockJobs,
        error: null
      }));

      const mockNot = vi.fn(() => ({
        order: mockOrder,
      }));

      const mockSelect = vi.fn(() => ({
        not: mockNot,
      }));

      const mockFrom = vi.fn(() => ({
        select: mockSelect,
      }));

      const supabase = { from: mockFrom };

      const result = await getDeadLetterQueueJobs(supabase as any);

      expect(mockFrom).toHaveBeenCalledWith('jobs');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockNot).toHaveBeenCalledWith('dlq_at', 'is', null);
      expect(mockOrder).toHaveBeenCalledWith('dlq_at', { ascending: false });
      expect(result).toEqual(mockJobs);
    });
  });

  describe('retryJobFromDeadLetterQueue', () => {
    it('should reset job status and clear DLQ fields', async () => {
      const jobId = 'test-job-id';

      const mockUpdate = vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({
          data: { id: jobId },
          error: null
        })),
      }));

      const mockFrom = vi.fn(() => ({
        update: mockUpdate,
      }));

      const supabase = { from: mockFrom };

      await retryJobFromDeadLetterQueue(supabase as any, jobId);

      expect(mockFrom).toHaveBeenCalledWith('jobs');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'PENDING',
          retry_count: 0,
          dlq_at: null,
          dlq_reason: null,
          error_code: null,
          error_message: null,
        })
      );
    });
  });
});
