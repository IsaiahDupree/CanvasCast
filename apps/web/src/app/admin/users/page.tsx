"use client";

/**
 * Admin User Management Page
 * ADMIN-003: User Management
 */

import { useState, useEffect } from "react";
import { Search, Plus, Minus, Ban, CheckCircle, Users as UsersIcon } from "lucide-react";

interface User {
  id: string;
  email: string;
  display_name: string | null;
  account_status: string;
  credit_balance: number;
  created_at: string;
  is_admin: boolean;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditNote, setCreditNote] = useState("");
  const [statusReason, setStatusReason] = useState("");
  const [newStatus, setNewStatus] = useState<"active" | "suspended" | "deleted">("active");

  useEffect(() => {
    fetchUsers();
  }, [pagination.page, searchQuery]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getAuthToken();
      const searchParam = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : "";
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/users?page=${pagination.page}&limit=${pagination.limit}${searchParam}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }

      const data = await response.json();
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const getAuthToken = async () => {
    // Get token from Supabase client
    const supabase = await import("@/lib/supabase/client").then((mod) => mod.createClient());
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || "";
  };

  const handleAdjustCredits = async () => {
    if (!selectedUser) return;

    try {
      const token = await getAuthToken();
      const amount = parseFloat(creditAmount);

      if (isNaN(amount)) {
        alert("Invalid credit amount");
        return;
      }

      if (!creditNote.trim()) {
        alert("Please provide a note for this adjustment");
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/users/${selectedUser.id}/credits`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount,
            note: creditNote,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to adjust credits");
      }

      // Refresh users list
      await fetchUsers();

      // Close modal and reset form
      setShowCreditModal(false);
      setCreditAmount("");
      setCreditNote("");
      setSelectedUser(null);
      alert("Credits adjusted successfully");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to adjust credits");
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedUser) return;

    try {
      const token = await getAuthToken();

      if (!statusReason.trim()) {
        alert("Please provide a reason for this status change");
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/users/${selectedUser.id}/status`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: newStatus,
            reason: statusReason,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update status");
      }

      // Refresh users list
      await fetchUsers();

      // Close modal and reset form
      setShowStatusModal(false);
      setStatusReason("");
      setSelectedUser(null);
      alert("Account status updated successfully");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const openCreditModal = (user: User) => {
    setSelectedUser(user);
    setShowCreditModal(true);
  };

  const openStatusModal = (user: User, status: "active" | "suspended" | "deleted") => {
    setSelectedUser(user);
    setNewStatus(status);
    setShowStatusModal(true);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: "bg-green-500/20 text-green-400 border-green-500/30",
      suspended: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      deleted: "bg-red-500/20 text-red-400 border-red-500/30",
    };

    return (
      <span
        className={`px-2 py-1 rounded text-xs font-medium border ${
          styles[status as keyof typeof styles] || "bg-gray-500/20 text-gray-400"
        }`}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <UsersIcon className="w-8 h-8 text-brand-500" />
          User Management
        </h1>
        <p className="text-gray-400 mt-2">
          Manage user accounts, credits, and access status
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by email or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading users...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-400">Error: {error}</div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No users found</div>
      ) : (
        <>
          <div className="bg-gray-900 border border-white/10 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-800 border-b border-white/10">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                    Credits
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                    Joined
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-white/5 transition">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center">
                          <span className="text-brand-400 font-medium">
                            {user.display_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-white">
                            {user.display_name || "Anonymous"}
                          </div>
                          {user.is_admin && (
                            <span className="text-xs text-brand-400">Admin</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-gray-300">{user.email}</td>
                    <td className="px-4 py-4">
                      <span className="font-mono text-brand-400">{user.credit_balance}</span>
                    </td>
                    <td className="px-4 py-4">{getStatusBadge(user.account_status)}</td>
                    <td className="px-4 py-4 text-gray-400 text-sm">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openCreditModal(user)}
                          className="p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition"
                          title="Adjust credits"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        {user.account_status === "active" ? (
                          <button
                            onClick={() => openStatusModal(user, "suspended")}
                            className="p-2 hover:bg-yellow-500/10 rounded text-gray-400 hover:text-yellow-400 transition"
                            title="Suspend account"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => openStatusModal(user, "active")}
                            className="p-2 hover:bg-green-500/10 rounded text-gray-400 hover:text-green-400 transition"
                            title="Activate account"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
              {pagination.total} users
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                disabled={pagination.page === 1}
                className="px-4 py-2 bg-gray-900 border border-white/10 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/5 transition"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                disabled={pagination.page >= pagination.pages}
                className="px-4 py-2 bg-gray-900 border border-white/10 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/5 transition"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {/* Credit Adjustment Modal */}
      {showCreditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-white/10 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Adjust Credits</h2>
            <p className="text-gray-400 mb-4">
              User: <span className="text-white">{selectedUser.email}</span>
            </p>
            <p className="text-gray-400 mb-4">
              Current balance:{" "}
              <span className="text-brand-400 font-mono">{selectedUser.credit_balance}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Amount (positive to add, negative to subtract)
                </label>
                <input
                  type="number"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder="e.g. 50 or -20"
                  className="w-full px-4 py-2 bg-gray-800 border border-white/10 rounded text-white focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Reason / Note</label>
                <textarea
                  value={creditNote}
                  onChange={(e) => setCreditNote(e.target.value)}
                  placeholder="e.g. Customer support adjustment"
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-800 border border-white/10 rounded text-white focus:outline-none focus:border-brand-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleAdjustCredits}
                  className="flex-1 py-2 bg-brand-500 hover:bg-brand-600 rounded text-white font-medium transition"
                >
                  Adjust Credits
                </button>
                <button
                  onClick={() => {
                    setShowCreditModal(false);
                    setCreditAmount("");
                    setCreditNote("");
                    setSelectedUser(null);
                  }}
                  className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 rounded text-white transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {showStatusModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-white/10 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Update Account Status</h2>
            <p className="text-gray-400 mb-4">
              User: <span className="text-white">{selectedUser.email}</span>
            </p>
            <p className="text-gray-400 mb-4">
              New status: <span className="text-white font-medium">{newStatus}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">Reason</label>
                <textarea
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="e.g. Terms of service violation"
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-800 border border-white/10 rounded text-white focus:outline-none focus:border-brand-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleUpdateStatus}
                  className="flex-1 py-2 bg-brand-500 hover:bg-brand-600 rounded text-white font-medium transition"
                >
                  Update Status
                </button>
                <button
                  onClick={() => {
                    setShowStatusModal(false);
                    setStatusReason("");
                    setSelectedUser(null);
                  }}
                  className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 rounded text-white transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
