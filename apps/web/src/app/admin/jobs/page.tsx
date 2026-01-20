"use client";

/**
 * Admin Jobs List Page
 * Lists all jobs in the system for admin inspection
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { Briefcase, Search, Eye, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Job {
  id: string;
  status: string;
  progress_pct: number;
  user_id: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  projects: {
    title: string;
  } | null;
}

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    async function fetchJobs() {
      try {
        const supabase = createClient();
        let query = supabase
          .from("jobs")
          .select(`
            id,
            status,
            progress_pct,
            user_id,
            created_at,
            started_at,
            finished_at,
            projects (title)
          `)
          .order("created_at", { ascending: false })
          .limit(50);

        if (statusFilter !== "all") {
          query = query.eq("status", statusFilter);
        }

        const { data, error } = await query;

        if (error) throw error;
        setJobs(data || []);
      } catch (err) {
        console.error("Error fetching jobs:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchJobs();
  }, [statusFilter]);

  const filteredJobs = jobs.filter(
    (job) =>
      job.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.user_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.projects?.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto py-8 px-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Briefcase className="w-8 h-8 text-brand-500" />
          <h1 className="text-3xl font-bold">Job Inspector</h1>
        </div>
        <p className="text-gray-400">
          View and inspect all jobs in the system
        </p>
      </div>

      {/* Filters */}
      <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by job ID, user ID, or project title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-brand-500 text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="queued">Queued</option>
            <option value="scripting">Scripting</option>
            <option value="image_gen">Image Gen</option>
            <option value="rendering">Rendering</option>
            <option value="ready">Ready</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No jobs found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">
                    Job ID
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">
                    Project
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">
                    Progress
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">
                    Created
                  </th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-gray-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-800/30 transition">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-400">
                        {job.id.slice(0, 8)}...
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm">
                        {job.projects?.title || "Untitled"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          job.status === "ready"
                            ? "bg-green-500/20 text-green-400"
                            : job.status === "failed"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-brand-500/20 text-brand-400"
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              job.status === "failed"
                                ? "bg-red-500"
                                : job.status === "ready"
                                ? "bg-green-500"
                                : "bg-brand-500"
                            }`}
                            style={{ width: `${job.progress_pct || 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400">
                          {job.progress_pct || 0}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(job.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/jobs/${job.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded bg-brand-600 hover:bg-brand-500 transition text-xs font-medium"
                      >
                        <Eye className="w-3 h-3" />
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Results Count */}
      {!loading && (
        <div className="mt-4 text-sm text-gray-400 text-center">
          Showing {filteredJobs.length} of {jobs.length} jobs
        </div>
      )}
    </div>
  );
}
