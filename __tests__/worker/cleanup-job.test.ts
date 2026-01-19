/**
 * Test: Asset Cleanup Job (STORAGE-003)
 *
 * Validates the asset cleanup job that removes old temporary files
 * from the temp-processing bucket on a scheduled basis.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Supabase
const mockDelete = vi.fn();
const mockList = vi.fn();
const mockStorage = {
  from: vi.fn(() => ({
    list: mockList,
    remove: mockDelete,
  })),
};

vi.mock("../../apps/worker/src/lib/supabase", () => ({
  createAdminSupabase: vi.fn(() => ({
    storage: mockStorage,
  })),
}));

describe("STORAGE-003: Asset Cleanup Job", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("cleanupTempFiles", () => {
    it("should delete temp files older than 24 hours", async () => {
      const { cleanupTempFiles } = await import("../../apps/worker/src/jobs/cleanup");

      // Set current time
      const now = new Date("2024-01-20T12:00:00Z");
      vi.setSystemTime(now);

      // Mock file list with old and recent files
      const oldFile = {
        name: "old-job-123/audio.mp3",
        created_at: new Date("2024-01-18T12:00:00Z").toISOString(), // 48 hours old
        updated_at: new Date("2024-01-18T12:00:00Z").toISOString(),
      };

      const recentFile = {
        name: "recent-job-456/audio.mp3",
        created_at: new Date("2024-01-20T11:00:00Z").toISOString(), // 1 hour old
        updated_at: new Date("2024-01-20T11:00:00Z").toISOString(),
      };

      mockList.mockResolvedValueOnce({
        data: [oldFile, recentFile],
        error: null,
      });

      // Empty batch to signal end
      mockList.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      mockDelete.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await cleanupTempFiles();

      // Should call list on temp-processing bucket
      expect(mockStorage.from).toHaveBeenCalledWith("temp-processing");
      expect(mockList).toHaveBeenCalledWith("jobs", {
        limit: 1000,
        offset: 0,
      });

      // Should only delete old files
      expect(mockDelete).toHaveBeenCalledTimes(1);
      expect(mockDelete).toHaveBeenCalledWith(["jobs/old-job-123/audio.mp3"]);

      // Should return count of deleted files
      expect(result).toEqual({
        deleted: 1,
        scanned: 2,
      });
    });

    it("should handle empty temp bucket", async () => {
      const { cleanupTempFiles } = await import("../../apps/worker/src/jobs/cleanup");

      mockList.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const result = await cleanupTempFiles();

      expect(mockDelete).not.toHaveBeenCalled();
      expect(result).toEqual({
        deleted: 0,
        scanned: 0,
      });
    });

    it("should handle storage errors gracefully", async () => {
      const { cleanupTempFiles } = await import("../../apps/worker/src/jobs/cleanup");

      mockList.mockResolvedValueOnce({
        data: null,
        error: { message: "Storage unavailable" },
      });

      await expect(cleanupTempFiles()).rejects.toThrow("Failed to list temp files");
    });

    it("should process files in batches if count exceeds limit", async () => {
      const { cleanupTempFiles } = await import("../../apps/worker/src/jobs/cleanup");

      const now = new Date("2024-01-20T12:00:00Z");
      vi.setSystemTime(now);

      // Create 1500 old files (exceeds batch size of 1000)
      const oldFiles = Array.from({ length: 1500 }, (_, i) => ({
        name: `job-${i}/audio.mp3`,
        created_at: new Date("2024-01-18T12:00:00Z").toISOString(),
        updated_at: new Date("2024-01-18T12:00:00Z").toISOString(),
      }));

      // First batch (1000 files)
      mockList.mockResolvedValueOnce({
        data: oldFiles.slice(0, 1000),
        error: null,
      });

      // Second batch (500 files)
      mockList.mockResolvedValueOnce({
        data: oldFiles.slice(1000),
        error: null,
      });

      // Third batch (empty, signals end)
      mockList.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      mockDelete.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await cleanupTempFiles();

      // Should make 3 list calls (2 with data, 1 empty)
      expect(mockList).toHaveBeenCalledTimes(3);

      // Should make 2 delete calls (one per batch with files)
      expect(mockDelete).toHaveBeenCalledTimes(2);

      expect(result.deleted).toBe(1500);
      expect(result.scanned).toBe(1500);
    });
  });

  describe("scheduleCleanupJob", () => {
    it("should schedule cleanup to run daily", async () => {
      const { scheduleCleanupJob } = await import("../../apps/worker/src/jobs/cleanup");

      const mockInterval = vi.fn();
      global.setInterval = mockInterval;

      await scheduleCleanupJob();

      // Should schedule with 24-hour interval (86400000 ms)
      expect(mockInterval).toHaveBeenCalledWith(
        expect.any(Function),
        86400000
      );
    });

    it("should execute cleanup when interval triggers", async () => {
      const { scheduleCleanupJob, cleanupTempFiles } = await import("../../apps/worker/src/jobs/cleanup");

      mockList.mockResolvedValue({
        data: [],
        error: null,
      });

      let intervalCallback: Function | null = null;
      global.setInterval = vi.fn((cb: Function, _interval: number) => {
        intervalCallback = cb;
        return 1 as any;
      });

      await scheduleCleanupJob();

      // Trigger the interval callback
      expect(intervalCallback).toBeTruthy();
      if (intervalCallback) {
        await intervalCallback();
      }

      // Should have called list on temp-processing
      expect(mockStorage.from).toHaveBeenCalledWith("temp-processing");
    });
  });
});
