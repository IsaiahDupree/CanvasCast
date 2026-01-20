"use client";

import { useState } from "react";
import { RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

/**
 * RetryStepButton Component
 * Feature RESIL-004: User Self-Service Retry - UI to retry individual pipeline steps
 *
 * Allows users to retry a specific failed pipeline step without restarting the entire job.
 * Only steps after IMAGE_GEN can be retried individually (checkpoint threshold).
 */

interface RetryStepButtonProps {
  jobId: string;
  stepName: string;
  stepStatus: string;
  stepLabel: string;
  onRetrySuccess?: () => void;
}

interface RetryResponse {
  success: boolean;
  message?: string;
  stepName?: string;
  newStatus?: string;
  checkpointPreserved?: boolean;
  error?: string;
}

// Steps that can be retried individually (after checkpoint threshold)
const RETRIABLE_STEPS = ['IMAGE_GEN', 'TIMELINE_BUILD', 'RENDERING', 'PACKAGING'];

export default function RetryStepButton({
  jobId,
  stepName,
  stepStatus,
  stepLabel,
  onRetrySuccess,
}: RetryStepButtonProps) {
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean | null>(null);

  // Only show button for failed steps
  if (stepStatus !== 'FAILED') {
    return null;
  }

  const canRetry = RETRIABLE_STEPS.includes(stepName);

  const handleRetry = async () => {
    setRetrying(true);
    setMessage(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/v1/jobs/${jobId}/retry-step`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stepName }),
      });

      const data: RetryResponse = await res.json();

      if (!res.ok) {
        setMessage(data.error || 'Failed to retry step');
        setSuccess(false);
        setRetrying(false);
        return;
      }

      setMessage(data.message || 'Step retry started successfully');
      setSuccess(true);

      // Call success callback
      if (onRetrySuccess) {
        onRetrySuccess();
      }

      // Refresh page after 2 seconds to show updated status
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Retry step error:', error);
      setMessage('An unexpected error occurred');
      setSuccess(false);
      setRetrying(false);
    }
  };

  return (
    <div className="inline-flex flex-col gap-2">
      <button
        onClick={handleRetry}
        disabled={retrying || !canRetry}
        className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm rounded font-medium transition-colors"
        title={
          !canRetry
            ? `${stepLabel} cannot be retried individually. This step requires a full job retry.`
            : `Retry ${stepLabel} step`
        }
      >
        <RefreshCw
          className={`w-3.5 h-3.5 ${retrying ? "animate-spin" : ""}`}
        />
        {retrying ? "Retrying..." : "Retry Step"}
      </button>

      {!canRetry && (
        <p className="text-xs text-gray-600 max-w-xs">
          This step cannot be retried individually. Only steps after image
          generation can be retried separately.
        </p>
      )}

      {message && (
        <div
          className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
            success
              ? "bg-green-50 border border-green-200"
              : "bg-red-50 border border-red-200"
          }`}
        >
          {success ? (
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <p
            className={`text-xs ${
              success ? "text-green-800" : "text-red-800"
            }`}
          >
            {message}
          </p>
        </div>
      )}
    </div>
  );
}
