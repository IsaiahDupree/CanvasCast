import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin Job Inspector API Endpoint (ADMIN-002)
 *
 * GET /api/admin/jobs/[id]
 *
 * Returns detailed job information for any job (admin only)
 * Includes: job details, step logs, artifacts, worker info, costs
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params;
  const supabase = await createClient();

  // Check authentication and admin status
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify admin status
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json(
      { error: "Unauthorized: Admin access required" },
      { status: 403 }
    );
  }

  // Fetch complete job data (no user_id filter for admin)
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select(`
      *,
      job_steps (*),
      assets (*),
      projects (*)
    `)
    .eq("id", jobId)
    .single();

  if (jobError || !job) {
    return NextResponse.json(
      { error: "Job not found" },
      { status: 404 }
    );
  }

  // Sort steps by order
  const steps = (job.job_steps || []).sort(
    (a: { step_order: number }, b: { step_order: number }) =>
      a.step_order - b.step_order
  );

  // Format response with admin-specific details
  return NextResponse.json({
    jobId: job.id,
    projectId: job.project_id,
    userId: job.user_id,
    status: job.status,
    progress: job.progress_pct || 0,
    errorCode: job.error_code,
    errorMessage: job.error_message,
    claimedAt: job.claimed_at,
    claimedBy: job.claimed_by,
    startedAt: job.started_at,
    finishedAt: job.finished_at,
    costCreditsReserved: job.cost_credits_reserved,
    costCreditsFinal: job.cost_credits_final,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    steps: steps.map((step: {
      step_name: string;
      state: string;
      progress_pct: number;
      status_message: string;
      error_message: string;
      started_at: string;
      finished_at: string;
      logs_url: string;
      artifacts_json: any;
    }) => ({
      stepName: step.step_name,
      state: step.state,
      progressPct: step.progress_pct,
      statusMessage: step.status_message,
      errorMessage: step.error_message,
      startedAt: step.started_at,
      finishedAt: step.finished_at,
      logsUrl: step.logs_url,
      // Parse logs from logs_url or use empty array
      logs: step.logs_url ? [] : [], // TODO: Fetch from logs_url if needed
      artifacts: step.artifacts_json || [],
    })),
    assets: (job.assets || []).map((asset: {
      id: string;
      type: string;
      path: string;
      url: string;
      metadata_json: Record<string, unknown>;
    }) => ({
      id: asset.id,
      type: asset.type,
      path: asset.path,
      url: asset.url,
      metadata: asset.metadata_json || {},
    })),
    project: job.projects ? {
      id: job.projects.id,
      title: job.projects.title,
      nichePreset: job.projects.niche_preset,
    } : null,
  });
}
