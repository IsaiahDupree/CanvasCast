"use client";

/**
 * Admin Queue Health Dashboard
 * ADMIN-004: Queue Health Dashboard
 */

import { useState, useEffect } from "react";
import { Activity, AlertTriangle, CheckCircle, XCircle, Pause, Play, RefreshCw } from "lucide-react";

interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  isPaused: boolean;
}

interface StuckJob {
  id: string;
  name: string;
  timestamp: number;
  duration: number;
  data?: any;
}

interface QueueHealthData {
  queues: QueueStats[];
  stuckJobs: StuckJob[];
  workers: {
    active: number;
  };
}

export default function QueuesPage() {
  const [data, setData] = useState<QueueHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchQueueStats();

    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchQueueStats, 5000);

    return () => clearInterval(interval);
  }, []);

  const fetchQueueStats = async () => {
    if (!loading) {
      setRefreshing(true);
    }

    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/queues/stats`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch queue stats");
      }

      const queueData = await response.json();
      setData(queueData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getAuthToken = async () => {
    const supabase = await import("@/lib/supabase/client").then((mod) => mod.createClient());
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || "";
  };

  const handleRetryJob = async (queueName: string, jobId: string) => {
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/queues/${queueName}/retry/${jobId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to retry job");
      }

      alert("Job queued for retry");
      await fetchQueueStats();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to retry job");
    }
  };

  const handlePauseQueue = async (queueName: string) => {
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/queues/${queueName}/pause`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to pause queue");
      }

      alert("Queue paused");
      await fetchQueueStats();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to pause queue");
    }
  };

  const handleResumeQueue = async (queueName: string) => {
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/queues/${queueName}/resume`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to resume queue");
      }

      alert("Queue resumed");
      await fetchQueueStats();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to resume queue");
    }
  };

  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-gray-400">Loading queue statistics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-red-400">Error: {error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-gray-400">No queue data available</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Activity className="w-8 h-8 text-brand-500" />
            Queue Health Dashboard
          </h1>
          <p className="text-gray-400 mt-2">Monitor worker status, pending jobs, and stuck jobs</p>
        </div>

        <button
          onClick={fetchQueueStats}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-white/10 rounded-lg text-white hover:bg-white/5 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Worker Status */}
      <div className="mb-6 bg-gray-900 border border-white/10 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Worker Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Active Workers</div>
            <div className="text-3xl font-bold text-green-400">{data.workers.active}</div>
          </div>
        </div>
      </div>

      {/* Queue Statistics */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-4">Queue Statistics</h2>
        <div className="space-y-4">
          {data.queues.map((queue) => (
            <div key={queue.name} className="bg-gray-900 border border-white/10 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold">{queue.name}</h3>
                  {queue.isPaused ? (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                      Paused
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                      Active
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  {queue.isPaused ? (
                    <button
                      onClick={() => handleResumeQueue(queue.name)}
                      className="flex items-center gap-2 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 rounded text-green-400 transition"
                    >
                      <Play className="w-4 h-4" />
                      Resume
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePauseQueue(queue.name)}
                      className="flex items-center gap-2 px-3 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 rounded text-yellow-400 transition"
                    >
                      <Pause className="w-4 h-4" />
                      Pause
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Waiting</div>
                  <div className="text-2xl font-bold text-blue-400">{queue.waiting}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Active</div>
                  <div className="text-2xl font-bold text-yellow-400">{queue.active}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Completed</div>
                  <div className="text-2xl font-bold text-green-400">{queue.completed}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Failed</div>
                  <div className="text-2xl font-bold text-red-400">{queue.failed}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Delayed</div>
                  <div className="text-2xl font-bold text-gray-400">{queue.delayed}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stuck Jobs */}
      {data.stuckJobs.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-yellow-400" />
            Stuck Jobs (Active &gt; 30 minutes)
          </h2>
          <div className="bg-gray-900 border border-yellow-500/30 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-800 border-b border-white/10">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Job ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Queue</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Duration</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Started</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.stuckJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-white/5 transition">
                    <td className="px-4 py-4 font-mono text-sm text-gray-300">{job.id}</td>
                    <td className="px-4 py-4 text-gray-300">{job.name}</td>
                    <td className="px-4 py-4">
                      <span className="text-yellow-400 font-medium">
                        {formatDuration(job.duration)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-400 text-sm">
                      {new Date(job.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleRetryJob(job.name, job.id as string)}
                          className="px-3 py-1 bg-brand-500/20 hover:bg-brand-500/30 rounded text-brand-400 text-sm transition"
                        >
                          Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Healthy Status */}
      {data.stuckJobs.length === 0 && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-400" />
            <div>
              <h3 className="text-lg font-bold text-green-400">All Systems Operational</h3>
              <p className="text-gray-400 text-sm">No stuck jobs detected</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
