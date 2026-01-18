"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle,
  Circle,
  Loader2,
  XCircle,
  Mail,
  ArrowLeft,
  Download,
  Play,
  RefreshCw,
} from "lucide-react";

interface JobStep {
  name: string;
  state: "pending" | "started" | "succeeded" | "failed" | "skipped";
  progressPct: number;
  message: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

interface Asset {
  id: string;
  type: string;
  url: string;
  metadata: Record<string, unknown>;
}

interface JobStatus {
  jobId: string;
  projectId: string;
  state: string;
  progressPct: number;
  statusMessage: string;
  failedStep: string | null;
  error: { message: string; step: string } | null;
  steps: JobStep[];
  assets: Asset[];
  project: {
    id: string;
    title: string;
    niche: string;
  } | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

const STEP_LABELS: Record<string, { label: string; description: string }> = {
  queued: { label: "Queued", description: "Waiting in the queue" },
  scripting: { label: "Writing Script", description: "AI is crafting your script" },
  scene_planning: { label: "Planning Scenes", description: "Organizing visual scenes" },
  image_gen: { label: "Generating Images", description: "Creating visuals for each scene" },
  voice_gen: { label: "Voice Generation", description: "Creating narration audio" },
  alignment: { label: "Caption Sync", description: "Aligning captions to audio" },
  rendering: { label: "Rendering", description: "Assembling your video" },
  packaging: { label: "Packaging", description: "Preparing your download files" },
  ready: { label: "Ready", description: "Your video is complete!" },
};

export default function JobStatusPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;

  const [job, setJob] = useState<JobStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailNotify, setEmailNotify] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch job status");
      }
      const data = await res.json();
      setJob(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load status");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  // Initial fetch and polling
  useEffect(() => {
    fetchStatus();

    // Poll every 3 seconds while job is in progress
    const interval = setInterval(() => {
      if (job && !["ready", "failed"].includes(job.state)) {
        fetchStatus();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchStatus, job?.state]);

  // Redirect to result page when ready
  useEffect(() => {
    if (job?.state === "ready") {
      // Stay on this page but show download options
    }
  }, [job?.state, router]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <XCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
        <h1 className="text-2xl font-bold mb-2">Error Loading Job</h1>
        <p className="text-gray-400 mb-6">{error || "Job not found"}</p>
        <Link
          href="/app"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand-600 hover:bg-brand-500 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const isComplete = job.state === "ready";
  const isFailed = job.state === "failed";
  const isProcessing = !isComplete && !isFailed;

  // Find current step index
  const currentStepIndex = job.steps.findIndex(
    (s) => s.state === "started" || s.state === "pending"
  );

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/app"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold mb-2">
          {job.project?.title || "Video Generation"}
        </h1>
        <p className="text-gray-400">{job.statusMessage}</p>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-400">Progress</span>
          <span className="font-medium">{job.progressPct}%</span>
        </div>
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              isFailed
                ? "bg-red-500"
                : isComplete
                ? "bg-green-500"
                : "bg-brand-500"
            }`}
            style={{ width: `${job.progressPct}%` }}
          />
        </div>
      </div>

      {/* Steps Stepper */}
      <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6 mb-8">
        <h2 className="text-lg font-semibold mb-6">Generation Progress</h2>
        <div className="space-y-4">
          {job.steps
            .filter((step) => step.name !== "queued") // Skip queued step in display
            .map((step, index) => {
              const stepInfo = STEP_LABELS[step.name] || {
                label: step.name,
                description: "",
              };
              const isCurrentStep = step.state === "started";
              const isCompleted = step.state === "succeeded";
              const isFailed = step.state === "failed";
              const isPending = step.state === "pending";

              return (
                <div
                  key={step.name}
                  className={`flex items-start gap-4 p-3 rounded-lg transition ${
                    isCurrentStep
                      ? "bg-brand-500/10 border border-brand-500/20"
                      : ""
                  }`}
                >
                  {/* Status Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {isCompleted && (
                      <CheckCircle className="w-6 h-6 text-green-400" />
                    )}
                    {isFailed && <XCircle className="w-6 h-6 text-red-400" />}
                    {isCurrentStep && (
                      <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
                    )}
                    {isPending && (
                      <Circle className="w-6 h-6 text-gray-600" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center justify-between">
                      <h3
                        className={`font-medium ${
                          isPending ? "text-gray-500" : "text-white"
                        }`}
                      >
                        {stepInfo.label}
                      </h3>
                      {isCurrentStep && step.progressPct > 0 && (
                        <span className="text-sm text-brand-400">
                          {step.progressPct}%
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-sm ${
                        isPending ? "text-gray-600" : "text-gray-400"
                      }`}
                    >
                      {step.message || stepInfo.description}
                    </p>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Failed State */}
      {isFailed && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <XCircle className="w-8 h-8 text-red-400 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-red-400 mb-2">
                Generation Failed
              </h3>
              <p className="text-gray-300 mb-4">
                {job.error?.message ||
                  "Something went wrong during video generation."}
              </p>
              <p className="text-sm text-gray-400 mb-4">
                Failed step: {job.failedStep || "Unknown"}
              </p>
              <div className="flex gap-3">
                <Link
                  href={`/app/new?retry=${job.projectId}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 transition text-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </Link>
                <Link
                  href="/app"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition text-sm"
                >
                  Back to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ready State - Download Options */}
      {isComplete && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <CheckCircle className="w-8 h-8 text-green-400 flex-shrink-0" />
            <div className="flex-grow">
              <h3 className="text-lg font-semibold text-green-400 mb-2">
                Your Video is Ready!
              </h3>
              <p className="text-gray-300 mb-6">
                Download your video and all generated assets below.
              </p>

              {/* Video Preview */}
              {job.assets.find((a) => a.type === "video") && (
                <div className="mb-6">
                  <video
                    src={job.assets.find((a) => a.type === "video")?.url}
                    controls
                    className="w-full rounded-lg bg-black"
                  />
                </div>
              )}

              {/* Download Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {job.assets.find((a) => a.type === "video") && (
                  <a
                    href={job.assets.find((a) => a.type === "video")?.url}
                    download
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-brand-600 hover:bg-brand-500 transition text-sm font-medium"
                  >
                    <Play className="w-4 h-4" />
                    MP4 Video
                  </a>
                )}
                {job.assets.find((a) => a.type === "captions") && (
                  <a
                    href={job.assets.find((a) => a.type === "captions")?.url}
                    download
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 transition text-sm font-medium"
                  >
                    <Download className="w-4 h-4" />
                    Captions
                  </a>
                )}
                {job.assets.find((a) => a.type === "audio") && (
                  <a
                    href={job.assets.find((a) => a.type === "audio")?.url}
                    download
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 transition text-sm font-medium"
                  >
                    <Download className="w-4 h-4" />
                    Audio
                  </a>
                )}
                {job.assets.find((a) => a.type === "zip") && (
                  <a
                    href={job.assets.find((a) => a.type === "zip")?.url}
                    download
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 transition text-sm font-medium col-span-2 sm:col-span-3"
                  >
                    <Download className="w-4 h-4" />
                    Download All Assets (ZIP)
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Processing State - Email Option */}
      {isProcessing && (
        <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Mail className="w-5 h-5 text-gray-400" />
            <h3 className="font-medium">Email Notification</h3>
          </div>
          <p className="text-gray-400 text-sm mb-4">
            We&apos;ll email you when your video is ready. You can leave this
            page.
          </p>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={emailNotify}
              onChange={(e) => setEmailNotify(e.target.checked)}
              className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm">Email me when ready</span>
          </label>
        </div>
      )}

      {/* Generate Another CTA */}
      {isComplete && (
        <div className="text-center mt-8">
          <Link
            href="/app/new"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand-600 hover:bg-brand-500 transition font-medium"
          >
            Generate Another Video
          </Link>
        </div>
      )}
    </div>
  );
}
