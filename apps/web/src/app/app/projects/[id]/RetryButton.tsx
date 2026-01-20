"use client";

import { useState } from "react";
import { RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

interface RetryButtonProps {
  projectId: string;
  hasFailedJob: boolean;
  onRetrySuccess?: () => void;
}

interface CheckpointInfo {
  lastCompletedStep: string;
  message: string;
}

interface RetryResponse {
  success: boolean;
  job: {
    id: string;
  };
  retryType: "checkpoint" | "full";
  checkpoint?: CheckpointInfo;
  error?: string;
  required?: number;
  available?: number;
}

export default function RetryButton({
  projectId,
  hasFailedJob,
  onRetrySuccess,
}: RetryButtonProps) {
  const [retrying, setRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [retryType, setRetryType] = useState<"checkpoint" | "full" | null>(
    null
  );

  if (!hasFailedJob) {
    return null;
  }

  const handleRetry = async () => {
    setRetrying(true);
    setRetryMessage(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/retry`, {
        method: "POST",
      });

      const data: RetryResponse = await res.json();

      if (!res.ok) {
        if (res.status === 402) {
          setRetryMessage(
            `Insufficient credits. Need ${data.required}, have ${data.available}.`
          );
        } else {
          setRetryMessage(data.error || "Failed to retry job");
        }
        setRetrying(false);
        return;
      }

      setRetryType(data.retryType);
      setRetryMessage(
        data.checkpoint?.message ||
          `Job retry started successfully as ${data.retryType} retry`
      );

      // Call success callback
      if (onRetrySuccess) {
        onRetrySuccess();
      }

      // Refresh page after 2 seconds
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error("Retry error:", error);
      setRetryMessage("An unexpected error occurred");
      setRetrying(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={handleRetry}
        disabled={retrying}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
      >
        <RefreshCw
          className={`w-4 h-4 ${retrying ? "animate-spin" : ""}`}
        />
        {retrying ? "Retrying..." : "Retry Job"}
      </button>

      {retryMessage && (
        <div
          className={`flex items-start gap-2 p-4 rounded-lg ${
            retryType
              ? "bg-green-50 border border-green-200"
              : "bg-red-50 border border-red-200"
          }`}
        >
          {retryType ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p
              className={`text-sm ${
                retryType ? "text-green-800" : "text-red-800"
              }`}
            >
              {retryMessage}
            </p>
            {retryType === "checkpoint" && (
              <p className="text-xs text-green-700 mt-1">
                Your expensive assets (images, voice) have been preserved.
                You'll only be charged for the remaining steps.
              </p>
            )}
            {retryType === "full" && (
              <p className="text-xs text-green-700 mt-1">
                Starting a new job from the beginning.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="text-sm text-gray-600">
        <p className="font-medium mb-2">About Retry:</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>
            If your job failed after image generation, we'll resume from where
            it stopped
          </li>
          <li>You won't be charged again for completed steps</li>
          <li>All generated assets will be preserved and reused</li>
        </ul>
      </div>
    </div>
  );
}
