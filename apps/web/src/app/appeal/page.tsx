'use client';

/**
 * Appeal Form Page (MOD-004)
 *
 * Allows users to submit appeals for blocked content.
 * Users can provide their reasoning for why they believe
 * their content was incorrectly flagged.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AppealPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    original_content: '',
    reason: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Get auth token from cookie or localStorage
      // This is a simplified version - in production you'd use proper auth
      const token = localStorage.getItem('supabase.auth.token');

      if (!token) {
        setError('You must be logged in to submit an appeal');
        setIsSubmitting(false);
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8989'}/api/v1/appeals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          original_content: formData.original_content.trim(),
          reason: formData.reason.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit appeal');
      }

      const data = await response.json();
      setSuccess(true);

      // Redirect to appeals list after 2 seconds
      setTimeout(() => {
        router.push('/app/appeals');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <div className="mb-4">
            <svg
              className="mx-auto h-12 w-12 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Appeal Submitted</h2>
          <p className="text-gray-600 mb-4">
            Thank you for submitting your appeal. We will review it and get back to you shortly.
          </p>
          <p className="text-sm text-gray-500">Redirecting to your appeals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Submit an Appeal
            </h1>
            <p className="text-gray-600">
              If you believe your content was incorrectly flagged or blocked, please provide
              details below. Our team will review your appeal and respond within 24-48 hours.
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="original_content"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Original Content *
              </label>
              <textarea
                id="original_content"
                name="original_content"
                rows={4}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter the exact content that was flagged or blocked..."
                value={formData.original_content}
                onChange={handleChange}
              />
              <p className="mt-1 text-sm text-gray-500">
                Please provide the exact content that was moderated.
              </p>
            </div>

            <div>
              <label
                htmlFor="reason"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Reason for Appeal *
              </label>
              <textarea
                id="reason"
                name="reason"
                rows={6}
                required
                minLength={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Explain why you believe this content should not have been flagged... (minimum 10 characters)"
                value={formData.reason}
                onChange={handleChange}
              />
              <p className="mt-1 text-sm text-gray-500">
                Please provide a detailed explanation (minimum 10 characters). The more
                information you provide, the faster we can resolve your appeal.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-800">
                    <strong>What happens next?</strong> Your appeal will be reviewed by our
                    moderation team. You will receive an email notification once a decision has
                    been made. Average response time is 24-48 hours.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || formData.reason.length < 10}
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Appeal'}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-8 bg-gray-100 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Appeal Guidelines
          </h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Be specific about why you believe the moderation was incorrect</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Provide context that may not have been clear in the original content</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Remain professional and courteous in your explanation</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                Appeals are typically reviewed within 24-48 hours during business days
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                Repeated appeals for the same content that has been reviewed will not be
                processed
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
