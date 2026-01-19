import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useJobStatus } from "@/hooks/useJobStatus";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("useJobStatus Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch job status on mount", async () => {
    const mockJob = {
      id: "job-123",
      project_id: "project-123",
      user_id: "user-123",
      status: "QUEUED",
      progress: 0,
      error_code: null,
      error_message: null,
      claimed_at: null,
      claimed_by: null,
      started_at: null,
      finished_at: null,
      cost_credits_reserved: 5,
      cost_credits_final: 0,
      created_at: "2026-01-19T00:00:00Z",
      updated_at: "2026-01-19T00:00:00Z",
      job_steps: [],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ job: mockJob }),
    });

    const { result } = renderHook(() => useJobStatus("job-123"));

    expect(result.current.loading).toBe(true);
    expect(result.current.job).toBeNull();
    expect(result.current.error).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.job).toEqual(mockJob);
    expect(result.current.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith("/api/v1/jobs/job-123/status");
  });

  it("should poll every 3 seconds when job is in progress", async () => {
    vi.useFakeTimers();

    const mockJobInProgress = {
      id: "job-123",
      status: "SCRIPTING",
      progress: 25,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ job: mockJobInProgress }),
    });

    renderHook(() => useJobStatus("job-123"));

    // Initial fetch
    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Advance timers by 3 seconds
    await vi.advanceTimersByTimeAsync(3000);

    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Advance timers by another 3 seconds
    await vi.advanceTimersByTimeAsync(3000);

    expect(mockFetch).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it("should stop polling when job status is READY", async () => {
    vi.useFakeTimers();

    const mockJobReady = {
      id: "job-123",
      status: "READY",
      progress: 100,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ job: mockJobReady }),
    });

    renderHook(() => useJobStatus("job-123"));

    // Initial fetch
    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Advance timers - should not trigger another fetch
    await vi.advanceTimersByTimeAsync(10000);

    expect(mockFetch).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("should stop polling when job status is FAILED", async () => {
    vi.useFakeTimers();

    const mockJobFailed = {
      id: "job-123",
      status: "FAILED",
      progress: 50,
      error_message: "Something went wrong",
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ job: mockJobFailed }),
    });

    renderHook(() => useJobStatus("job-123"));

    // Initial fetch
    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Advance timers - should not trigger another fetch
    await vi.advanceTimersByTimeAsync(10000);

    expect(mockFetch).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("should handle fetch errors", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useJobStatus("job-123"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.job).toBeNull();
    expect(result.current.error).toBe("Network error");
  });

  it("should handle 404 errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "Job not found" }),
    });

    const { result } = renderHook(() => useJobStatus("job-123"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.job).toBeNull();
    expect(result.current.error).toBe("Job not found");
  });

  it("should cleanup interval on unmount", async () => {
    vi.useFakeTimers();

    const mockJob = {
      id: "job-123",
      status: "SCRIPTING",
      progress: 25,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ job: mockJob }),
    });

    const { unmount } = renderHook(() => useJobStatus("job-123"));

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    unmount();

    // Advance timers - should not trigger fetch after unmount
    await vi.advanceTimersByTimeAsync(10000);

    expect(mockFetch).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("should not start polling if jobId is null", () => {
    renderHook(() => useJobStatus(null));

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should restart polling when jobId changes", async () => {
    const mockJob1 = {
      id: "job-1",
      status: "SCRIPTING",
      progress: 25,
    };

    const mockJob2 = {
      id: "job-2",
      status: "QUEUED",
      progress: 0,
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ job: mockJob1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ job: mockJob2 }),
      });

    const { rerender } = renderHook(
      ({ jobId }) => useJobStatus(jobId),
      { initialProps: { jobId: "job-1" } }
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/jobs/job-1/status");
    });

    rerender({ jobId: "job-2" });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/jobs/job-2/status");
    });
  });
});
