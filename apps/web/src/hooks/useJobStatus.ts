"use client";

import { useEffect, useState } from "react";
import type { Job } from "@canvascast/shared";

/**
 * useJobStatus Hook
 *
 * Manages job status polling for real-time progress updates.
 *
 * Features:
 * - Fetches job status on mount
 * - Polls every 3 seconds while job is in progress
 * - Stops polling when job is completed (READY) or failed (FAILED)
 * - Handles loading and error states
 * - Cleans up polling interval on unmount
 * - Restarts polling when jobId changes
 *
 * @param jobId - The job ID to poll status for (null to disable polling)
 * @returns {Object} Job status state
 * @returns {Job | null} job - Current job data or null
 * @returns {boolean} loading - True during initial fetch
 * @returns {string | null} error - Error message if fetch failed
 *
 * @example
 * ```tsx
 * function JobProgressPage({ params }: { params: { id: string } }) {
 *   const { job, loading, error } = useJobStatus(params.id);
 *
 *   if (loading) return <div>Loading job status...</div>;
 *   if (error) return <div>Error: {error}</div>;
 *   if (!job) return <div>Job not found</div>;
 *
 *   return (
 *     <div>
 *       <h1>Job Status: {job.status}</h1>
 *       <progress value={job.progress} max={100} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useJobStatus(jobId: string | null) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Don't start polling if no jobId provided
    if (!jobId) {
      setLoading(false);
      return;
    }

    let intervalId: NodeJS.Timeout | null = null;
    let isMounted = true;

    const fetchJobStatus = async () => {
      try {
        const response = await fetch(`/api/v1/jobs/${jobId}/status`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch job status");
        }

        const data = await response.json();

        if (isMounted) {
          setJob(data.job);
          setError(null);
          setLoading(false);

          // Stop polling if job is in terminal state
          if (data.job.status === "READY" || data.job.status === "FAILED" || data.job.status === "CANCELED") {
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unknown error");
          setLoading(false);

          // Stop polling on error
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
      }
    };

    // Initial fetch
    fetchJobStatus();

    // Set up polling interval (every 3 seconds)
    intervalId = setInterval(fetchJobStatus, 3000);

    // Cleanup function
    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [jobId]);

  return { job, loading, error };
}
