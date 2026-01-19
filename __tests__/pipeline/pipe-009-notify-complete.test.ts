/**
 * Tests for Notify Complete Step
 * Feature: PIPE-009 - Notify Complete Step
 *
 * This test suite covers:
 * - Finalizing job credits after successful completion
 * - Queuing email notification (if email queue exists)
 * - Updating job status to completed
 * - Error handling for credit finalization failures
 * - Graceful handling when email queue is not available
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PipelineContext, JobRow, ProjectRow } from '../../apps/worker/src/pipeline/types';

// Mock Supabase first - before any imports
const mockRpc = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockSupabaseClient = {
  rpc: mockRpc,
  from: vi.fn(() => ({
    update: mockUpdate,
  })),
};

// Setup chain for update
mockUpdate.mockReturnValue({
  eq: mockEq,
});
mockEq.mockResolvedValue({ data: null, error: null });

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

// Import after mocking
const { notifyComplete } = await import('../../apps/worker/src/pipeline/steps/notify-complete');

describe('PIPE-009: Notify Complete Step', () => {
  let mockContext: PipelineContext;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Set up environment
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    // Mock Supabase operations
    mockRpc.mockResolvedValue({ data: null, error: null });

    // Create mock context with all required data
    const mockJob: JobRow = {
      id: 'job-123',
      project_id: 'project-456',
      user_id: 'user-789',
      status: 'packaging',
      progress: 90,
      error_code: null,
      error_message: null,
      claimed_at: new Date().toISOString(),
      claimed_by: 'worker-1',
      started_at: new Date().toISOString(),
      finished_at: null,
      cost_credits_reserved: 10,
      cost_credits_final: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockProject: ProjectRow = {
      id: 'project-456',
      user_id: 'user-789',
      title: 'Test Video Project',
      niche_preset: 'educational',
      target_minutes: 1,
      status: 'processing',
      template_id: 'default',
      visual_preset_id: 'modern',
      voice_profile_id: null,
      image_density: 'medium',
      target_resolution: '1080p',
      timeline_path: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockContext = {
      job: mockJob,
      project: mockProject,
      userId: 'user-789',
      projectId: 'project-456',
      jobId: 'job-123',
      basePath: 'project-assets/u_user-789/p_project-456/j_job-123',
      outputPath: 'project-outputs/u_user-789/p_project-456/j_job-123',
      artifacts: {
        videoPath: 'project-outputs/u_user-789/p_project-456/j_job-123/final.mp4',
        zipPath: 'generated-assets/users/user-789/jobs/job-123/assets.zip',
        narrationDurationMs: 60000,
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Credit Finalization', () => {
    it('should finalize job credits with actual cost', async () => {
      const result = await notifyComplete(mockContext);

      expect(result.success).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('finalize_job_credits', {
        p_user_id: 'user-789',
        p_job_id: 'job-123',
        p_final_cost: 10,
      });
    });

    it('should use reserved credits as final cost by default', async () => {
      await notifyComplete(mockContext);

      const rpcCall = mockRpc.mock.calls.find(
        (call: any) => call[0] === 'finalize_job_credits'
      );
      expect(rpcCall).toBeDefined();
      expect(rpcCall![1].p_final_cost).toBe(10); // Reserved amount
    });

    it('should handle credit finalization errors', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Credit finalization failed' },
      });

      const result = await notifyComplete(mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ERR_NOTIFY_COMPLETE');
      expect(result.error?.message).toContain('finalization');
    });
  });

  describe('Success Response', () => {
    it('should return success when credits are finalized', async () => {
      const result = await notifyComplete(mockContext);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should log completion message', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await notifyComplete(mockContext);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Notify]')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('completed successfully')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Email Notification (Future)', () => {
    it('should not fail if email queue is not available', async () => {
      // Email queue is not implemented yet (EMAIL-001)
      // This step should succeed even without email notifications
      const result = await notifyComplete(mockContext);

      expect(result.success).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero credits reserved', async () => {
      mockContext.job.cost_credits_reserved = 0;

      const result = await notifyComplete(mockContext);

      expect(result.success).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('finalize_job_credits', {
        p_user_id: 'user-789',
        p_job_id: 'job-123',
        p_final_cost: 0,
      });
    });

    it('should handle missing video path gracefully', async () => {
      delete mockContext.artifacts.videoPath;

      const result = await notifyComplete(mockContext);

      // Should still finalize credits even if artifacts are incomplete
      expect(result.success).toBe(true);
      expect(mockRpc).toHaveBeenCalled();
    });

    it('should handle missing zip path gracefully', async () => {
      delete mockContext.artifacts.zipPath;

      const result = await notifyComplete(mockContext);

      // Should still finalize credits even if artifacts are incomplete
      expect(result.success).toBe(true);
      expect(mockRpc).toHaveBeenCalled();
    });
  });

  describe('Error Details', () => {
    it('should include error details in response', async () => {
      const errorDetails = { code: 'CREDIT_UPDATE_FAILED', details: 'DB error' };
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: errorDetails,
      });

      const result = await notifyComplete(mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.details).toBeDefined();
    });
  });
});
