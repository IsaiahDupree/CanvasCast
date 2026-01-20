"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, ArrowLeft } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";

type DeletionStatus = {
  has_pending_deletion: boolean;
  scheduled_date: string | null;
  can_cancel: boolean;
  requested_at: string | null;
  reason: string | null;
};

export default function DeleteAccountPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletionStatus, setDeletionStatus] = useState<DeletionStatus | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Fetch deletion status
  useEffect(() => {
    async function fetchStatus() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push("/login");
          return;
        }

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/account/deletion-status`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setDeletionStatus(data);
        }
      } catch (err) {
        console.error("Failed to fetch deletion status:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
  }, [router, supabase.auth]);

  async function handleDeleteAccount() {
    if (confirmation !== "DELETE") {
      setError("Please type DELETE to confirm");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/account/delete`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmation: "DELETE",
          reason: reason || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to request account deletion");
      }

      // Refresh status
      const statusResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/account/deletion-status`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        setDeletionStatus(statusData);
      }

      setConfirmation("");
      setReason("");
    } catch (err: any) {
      setError(err.message || "Failed to request account deletion");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelDeletion() {
    setSubmitting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/account/cancel-deletion`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel account deletion");
      }

      // Refresh status
      const statusResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/account/deletion-status`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        setDeletionStatus(statusData);
      }
    } catch (err: any) {
      setError(err.message || "Failed to cancel account deletion");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Link
        href="/app/settings"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Settings
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2 text-red-400">Delete Account</h1>
        <p className="text-gray-400">
          Permanently delete your account and all associated data
        </p>
      </div>

      {/* Pending Deletion Warning */}
      {deletionStatus?.has_pending_deletion && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6 mb-6">
          <div className="flex gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-500 mb-2">Account Deletion Pending</h3>
              <p className="text-gray-300 mb-4">
                Your account is scheduled to be deleted on{" "}
                <strong>
                  {deletionStatus.scheduled_date
                    ? new Date(deletionStatus.scheduled_date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "N/A"}
                </strong>
                .
              </p>
              {deletionStatus.reason && (
                <p className="text-sm text-gray-400 mb-4">
                  Reason: {deletionStatus.reason}
                </p>
              )}
              {deletionStatus.can_cancel && (
                <button
                  onClick={handleCancelDeletion}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 transition font-medium"
                >
                  {submitting ? "Cancelling..." : "Cancel Deletion Request"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Warning Box */}
      {!deletionStatus?.has_pending_deletion && (
        <>
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 mb-6">
            <div className="flex gap-3">
              <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-400 mb-2">Warning: This action is permanent</h3>
                <div className="text-gray-300 space-y-2">
                  <p>Deleting your account will:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Delete all your video projects and generated content</li>
                    <li>Remove all your credits and subscription data</li>
                    <li>Cancel any active subscriptions</li>
                    <li>Delete your profile and account information</li>
                    <li>Remove all associated data after 30 days</li>
                  </ul>
                  <p className="mt-4 text-yellow-400 font-medium">
                    You will have 30 days to cancel this request before your data is permanently deleted.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Deletion Form */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Request Account Deletion</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="reason" className="block text-sm font-medium mb-2">
                  Reason for leaving (optional)
                </label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Help us improve by sharing why you're leaving..."
                  rows={3}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-brand-400 resize-none"
                />
              </div>

              <div>
                <label htmlFor="confirmation" className="block text-sm font-medium mb-2">
                  Type <span className="font-mono font-bold text-red-400">DELETE</span> to confirm
                </label>
                <input
                  id="confirmation"
                  type="text"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-red-400 font-mono"
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleDeleteAccount}
                disabled={submitting || confirmation !== "DELETE"}
                className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Delete My Account"
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Additional Information */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h3 className="font-semibold mb-3">What happens next?</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-400">
          <li>Your account will be marked for deletion in 30 days</li>
          <li>You'll receive a confirmation email with the deletion date</li>
          <li>During the 30-day period, you can cancel the deletion request</li>
          <li>After 30 days, all your data will be permanently deleted</li>
          <li>You can create a new account at any time with the same email after deletion is complete</li>
        </ol>
      </div>
    </div>
  );
}
