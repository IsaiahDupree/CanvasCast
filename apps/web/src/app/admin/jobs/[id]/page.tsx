"use client";

/**
 * Admin Job Inspector Page (ADMIN-002)
 *
 * View any job's pipeline state, logs, and artifacts
 * Admin-only access
 */

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  Circle,
  Clock,
  User,
  Coins,
  Download,
  FileText,
  AlertTriangle,
} from "lucide-react";

interface JobStep {
  stepName: string;
  state: "pending" | "started" | "succeeded" | "failed" | "skipped";
  progressPct: number;
  statusMessage: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  logsUrl: string | null;
  logs: string[];
  artifacts: any[];
}

interface JobAsset {
  id: string;
  type: string;
  path: string;
  url: string;
  metadata: Record<string, unknown>;
}

interface JobData {
  jobId: string;
  projectId: string;
  userId: string;
  status: string;
  progress: number;
  errorCode: string | null;
  errorMessage: string | null;
  claimedAt: string | null;
  claimedBy: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  costCreditsReserved: number;
  costCreditsFinal: number | null;
  createdAt: string;
  updatedAt: string;
  steps: JobStep[];
  assets: JobAsset[];
  project: {
    id: string;
    title: string;
    nichePreset: string;
  } | null;
}

const STEP_LABELS: Record<string, string> = {
  queued: "Queued",
  scripting: "Script Generation",
  scene_planning: "Scene Planning",
  image_gen: "Image Generation",
  voice_gen: "Voice Generation",
  alignment: "Caption Alignment",
  rendering: "Video Rendering",
  packaging: "Asset Packaging",
  ready: "Ready",
};

export default function JobInspectorPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [job, setJob] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchJobDetails() {
      try {
        const res = await fetch(`/api/admin/jobs/${jobId}`);
        if (!res.ok) {
          if (res.status === 403) {
            throw new Error("Unauthorized: Admin access required");
          }
          if (res.status === 404) {
            throw new Error("Job not found");
          }
          throw new Error("Failed to fetch job details");
        }
        const data = await res.json();
        setJob(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchJobDetails();
  }, [jobId]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            <h2 className="text-xl font-semibold text-red-400">Error</h2>
          </div>
          <p className="text-gray-300">{error || "Job not found"}</p>
          <Link
            href="/admin/jobs"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Job List
          </Link>
        </div>
      </div>
    );
  }

  const formatDate = (date: string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString();
  };

  const formatDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return "N/A";
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin/jobs"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Job List
        </Link>
        <h1 className="text-3xl font-bold mb-2">Job Inspector</h1>
        <p className="text-gray-400">
          {job.project?.title || "Untitled Project"}
        </p>
      </div>

      {/* Job Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Job Info */}
        <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-brand-500" />
            <h3 className="font-semibold">Job Info</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-400">ID:</span>
              <span className="ml-2 font-mono text-xs">{job.jobId}</span>
            </div>
            <div>
              <span className="text-gray-400">Status:</span>
              <span className="ml-2 font-semibold text-brand-400">
                {job.status}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Progress:</span>
              <span className="ml-2">{job.progress}%</span>
            </div>
          </div>
        </div>

        {/* Worker Info */}
        <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-5 h-5 text-green-500" />
            <h3 className="font-semibold">Worker Info</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-400">Claimed By:</span>
              <span className="ml-2 font-mono text-xs">
                {job.claimedBy || "Not claimed"}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Claimed At:</span>
              <span className="ml-2 text-xs">
                {formatDate(job.claimedAt)}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Duration:</span>
              <span className="ml-2">
                {formatDuration(job.startedAt, job.finishedAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Credits Info */}
        <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Coins className="w-5 h-5 text-yellow-500" />
            <h3 className="font-semibold">Credits</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-400">Reserved:</span>
              <span className="ml-2">{job.costCreditsReserved}</span>
            </div>
            <div>
              <span className="text-gray-400">Final:</span>
              <span className="ml-2">
                {job.costCreditsFinal || "Pending"}
              </span>
            </div>
            <div>
              <span className="text-gray-400">User ID:</span>
              <span className="ml-2 font-mono text-xs truncate block">
                {job.userId}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Timestamps */}
      <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold">Timeline</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-400 block mb-1">Created</span>
            <span className="text-xs">{formatDate(job.createdAt)}</span>
          </div>
          <div>
            <span className="text-gray-400 block mb-1">Started</span>
            <span className="text-xs">{formatDate(job.startedAt)}</span>
          </div>
          <div>
            <span className="text-gray-400 block mb-1">Finished</span>
            <span className="text-xs">{formatDate(job.finishedAt)}</span>
          </div>
        </div>
      </div>

      {/* Pipeline Steps */}
      <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6 mb-8">
        <h3 className="font-semibold text-lg mb-6">Pipeline Steps</h3>
        <div className="space-y-4">
          {job.steps.map((step) => {
            const isSuccess = step.state === "succeeded";
            const isFailed = step.state === "failed";
            const isActive = step.state === "started";
            const isPending = step.state === "pending";

            return (
              <div
                key={step.stepName}
                className={`border rounded-lg p-4 ${
                  isFailed
                    ? "border-red-500/30 bg-red-500/5"
                    : isActive
                    ? "border-brand-500/30 bg-brand-500/5"
                    : isSuccess
                    ? "border-green-500/30 bg-green-500/5"
                    : "border-gray-700"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {isSuccess && (
                      <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
                    )}
                    {isFailed && (
                      <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                    )}
                    {isActive && (
                      <Loader2 className="w-6 h-6 text-brand-400 animate-spin flex-shrink-0" />
                    )}
                    {isPending && (
                      <Circle className="w-6 h-6 text-gray-600 flex-shrink-0" />
                    )}
                    <div>
                      <h4 className="font-semibold">
                        {STEP_LABELS[step.stepName] || step.stepName}
                      </h4>
                      <p className="text-sm text-gray-400">
                        {step.statusMessage || "No status message"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-400">
                    {step.progressPct > 0 && (
                      <div className="font-semibold text-brand-400">
                        {step.progressPct}%
                      </div>
                    )}
                    {step.startedAt && (
                      <div className="text-xs">
                        {formatDuration(step.startedAt, step.finishedAt)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Error Message */}
                {step.errorMessage && (
                  <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-300">
                    <strong>Error:</strong> {step.errorMessage}
                  </div>
                )}

                {/* Logs */}
                {step.logs && step.logs.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-400 mb-2">Logs:</div>
                    <div className="bg-black/30 rounded p-3 max-h-40 overflow-y-auto">
                      {step.logs.map((log, idx) => (
                        <div
                          key={idx}
                          className="text-xs font-mono text-gray-300 mb-1"
                        >
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Assets */}
      {job.assets && job.assets.length > 0 && (
        <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Download className="w-5 h-5 text-purple-500" />
            <h3 className="font-semibold text-lg">Generated Assets</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {job.assets.map((asset) => (
              <div
                key={asset.id}
                className="border border-gray-700 rounded-lg p-4 hover:border-brand-500/50 transition"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold capitalize">{asset.type}</span>
                  <a
                    href={asset.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-400 hover:text-brand-300 text-sm flex items-center gap-1"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </a>
                </div>
                <div className="text-xs text-gray-400 font-mono truncate">
                  {asset.path}
                </div>
                {asset.metadata && Object.keys(asset.metadata).length > 0 && (
                  <div className="mt-2 text-xs text-gray-500">
                    {JSON.stringify(asset.metadata)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
