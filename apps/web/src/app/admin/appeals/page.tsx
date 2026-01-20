'use client';

/**
 * Admin Appeals Review Queue (MOD-004)
 *
 * Allows admins to view and resolve user appeals.
 * Provides filtering, search, and resolution capabilities.
 */

import { useState, useEffect } from 'react';

interface Appeal {
  id: string;
  created_at: string;
  user_id: string;
  audit_log_id: string | null;
  reason: string;
  original_content: string;
  status: 'pending' | 'approved' | 'denied';
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
}

export default function AdminAppealsPage() {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'denied'>('pending');
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  const fetchAppeals = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get auth token
      const token = localStorage.getItem('supabase.auth.token');

      if (!token) {
        throw new Error('Not authenticated');
      }

      const queryParams = new URLSearchParams();
      if (statusFilter !== 'all') {
        queryParams.append('status', statusFilter);
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8989'}/api/v1/appeals?${queryParams}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch appeals');
      }

      const data = await response.json();
      setAppeals(data.appeals || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppeals();
  }, [statusFilter]);

  const handleResolve = async (appealId: string, status: 'approved' | 'denied') => {
    if (!resolutionNotes.trim() || resolutionNotes.length < 10) {
      alert('Resolution notes must be at least 10 characters');
      return;
    }

    try {
      setIsResolving(true);

      const token = localStorage.getItem('supabase.auth.token');

      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8989'}/api/v1/appeals/${appealId}/resolve`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status,
            resolution_notes: resolutionNotes.trim(),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to resolve appeal');
      }

      // Refresh appeals list
      await fetchAppeals();

      // Close modal
      setSelectedAppeal(null);
      setResolutionNotes('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsResolving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      denied: 'bg-red-100 text-red-800',
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Appeals Review Queue</h1>
          <p className="text-gray-600">
            Review and resolve user appeals for moderated content
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Filter by status:</label>
            <div className="flex space-x-2">
              {(['all', 'pending', 'approved', 'denied'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    statusFilter === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading and Error States */}
        {loading && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading appeals...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Appeals List */}
        {!loading && !error && (
          <>
            {appeals.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <p className="text-gray-600">No appeals found for the selected filter.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {appeals.map((appeal) => (
                  <div key={appeal.id} className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          {getStatusBadge(appeal.status)}
                          <span className="text-sm text-gray-500">
                            {new Date(appeal.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">
                          <strong>User ID:</strong> {appeal.user_id}
                        </p>
                      </div>
                      {appeal.status === 'pending' && (
                        <button
                          onClick={() => setSelectedAppeal(appeal)}
                          className="ml-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                        >
                          Review
                        </button>
                      )}
                    </div>

                    <div className="border-t pt-4">
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">
                          Original Content:
                        </p>
                        <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded">
                          {appeal.original_content}
                        </p>
                      </div>

                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">
                          User's Reason:
                        </p>
                        <p className="text-sm text-gray-900">{appeal.reason}</p>
                      </div>

                      {appeal.resolution_notes && (
                        <div className="mt-3 bg-gray-50 p-3 rounded">
                          <p className="text-sm font-medium text-gray-700 mb-1">
                            Resolution Notes:
                          </p>
                          <p className="text-sm text-gray-900">{appeal.resolution_notes}</p>
                          {appeal.resolved_at && (
                            <p className="text-xs text-gray-500 mt-1">
                              Resolved on {new Date(appeal.resolved_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Resolution Modal */}
      {selectedAppeal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Resolve Appeal</h2>

            <div className="mb-6 space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Original Content:</p>
                <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded">
                  {selectedAppeal.original_content}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">User's Reason:</p>
                <p className="text-sm text-gray-900">{selectedAppeal.reason}</p>
              </div>
            </div>

            <div className="mb-6">
              <label
                htmlFor="resolution_notes"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Resolution Notes * (min 10 characters)
              </label>
              <textarea
                id="resolution_notes"
                rows={6}
                required
                minLength={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Provide detailed reasoning for your decision..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  setSelectedAppeal(null);
                  setResolutionNotes('');
                }}
                disabled={isResolving}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <div className="flex space-x-3">
                <button
                  onClick={() => handleResolve(selectedAppeal.id, 'denied')}
                  disabled={isResolving || resolutionNotes.length < 10}
                  className="px-6 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResolving ? 'Processing...' : 'Deny Appeal'}
                </button>
                <button
                  onClick={() => handleResolve(selectedAppeal.id, 'approved')}
                  disabled={isResolving || resolutionNotes.length < 10}
                  className="px-6 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResolving ? 'Processing...' : 'Approve Appeal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
