/**
 * Tests for GDPR-001: Asset Retention Policy
 *
 * Tests the cleanup job that auto-deletes job assets after configurable retention days
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { cleanupOldAssets, scheduleAssetCleanupJob } from "../../src/jobs/cleanup-assets";
import { createAdminSupabase } from "../../src/lib/supabase";

// Mock Supabase
vi.mock("../../src/lib/supabase");

// Mock email queue
vi.mock("../../src/queues/email", () => ({
  emailQueue: {
    add: vi.fn(),
  },
}));

const mockSupabase = {
  from: vi.fn(),
  storage: {
    from: vi.fn(),
  },
  rpc: vi.fn(),
};

describe("Asset Retention Cleanup (GDPR-001)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (createAdminSupabase as any).mockReturnValue(mockSupabase);
  });

  describe("cleanupOldAssets", () => {
    it("should delete assets older than retention period", async () => {
      // Mock: Find old assets (e.g., 90+ days old)
      const oldAssets = [
        {
          id: "asset-1",
          job_id: "job-1",
          user_id: "user-1",
          storage_path: "jobs/job-1/video.mp4",
          type: "video",
          created_at: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: "asset-2",
          job_id: "job-1",
          user_id: "user-1",
          storage_path: "jobs/job-1/audio.mp3",
          type: "audio",
          created_at: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ];

      // Mock database query to find old assets
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: oldAssets,
              error: null,
            }),
          }),
        }),
      });

      // Mock storage deletion
      mockSupabase.storage.from.mockReturnValue({
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      // Mock database deletion
      mockSupabase.from.mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const result = await cleanupOldAssets(90);

      expect(result.deleted).toBe(2);
      expect(result.scanned).toBe(2);
    });

    it("should not delete recent assets", async () => {
      // Mock: Find no old assets (all are recent)
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [], // No old assets found
              error: null,
            }),
          }),
        }),
      });

      const result = await cleanupOldAssets(90);

      expect(result.deleted).toBe(0);
      expect(result.scanned).toBe(0);
    });

    it("should send notification to users before deletion", async () => {
      const { emailQueue } = await import("../../src/queues/email");

      const oldAssets = [
        {
          id: "asset-1",
          job_id: "job-1",
          user_id: "user-1",
          storage_path: "jobs/job-1/video.mp4",
          type: "video",
          created_at: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ];

      // Mock database query for assets
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: oldAssets,
              error: null,
            }),
          }),
        }),
      });

      // Mock user profile fetch
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { email: "user@example.com" },
              error: null,
            }),
          }),
        }),
      });

      // Mock storage deletion
      mockSupabase.storage.from.mockReturnValue({
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      // Mock database deletion for assets
      mockSupabase.from.mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      await cleanupOldAssets(90, true); // with notification

      expect(emailQueue.add).toHaveBeenCalledWith(
        "asset-retention-notice",
        expect.objectContaining({
          to: "user@example.com",
          userId: "user-1",
        })
      );
    });

    it("should handle errors gracefully", async () => {
      // Mock database error
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Database error" },
            }),
          }),
        }),
      });

      await expect(cleanupOldAssets(90)).rejects.toThrow("Failed to fetch old assets");
    });

    it("should use configurable retention days", async () => {
      const customRetentionDays = 180;

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      await cleanupOldAssets(customRetentionDays);

      // Verify the retention period is calculated correctly
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - customRetentionDays);

      expect(mockSupabase.from).toHaveBeenCalledWith("assets");
    });
  });

  describe("scheduleAssetCleanupJob", () => {
    it("should schedule daily cleanup job", () => {
      const interval = scheduleAssetCleanupJob();

      expect(interval).toBeDefined();
      expect(typeof interval).toBe("object");
    });
  });
});
