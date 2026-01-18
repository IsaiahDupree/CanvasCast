import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get job with steps and assets
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select(`
      *,
      job_steps (*),
      assets (*),
      projects (*)
    `)
    .eq("id", jobId)
    .eq("user_id", user.id)
    .single();

  if (jobError || !job) {
    return NextResponse.json(
      { error: "Job not found" },
      { status: 404 }
    );
  }

  // Sort steps by order
  const steps = (job.job_steps || []).sort(
    (a: { step_order: number }, b: { step_order: number }) => a.step_order - b.step_order
  );

  // Format response per PRD API contract
  return NextResponse.json({
    jobId: job.id,
    projectId: job.project_id,
    state: job.status,
    progressPct: job.progress_pct || 0,
    statusMessage: job.status_message || getDefaultMessage(job.status),
    failedStep: job.failed_step,
    error: job.error_json,
    steps: steps.map((step: {
      step_name: string;
      state: string;
      progress_pct: number;
      status_message: string;
      started_at: string;
      finished_at: string;
    }) => ({
      name: step.step_name,
      state: step.state,
      progressPct: step.progress_pct,
      message: step.status_message,
      startedAt: step.started_at,
      finishedAt: step.finished_at,
    })),
    assets: (job.assets || []).map((asset: {
      id: string;
      type: string;
      url: string;
      metadata_json: Record<string, unknown>;
    }) => ({
      id: asset.id,
      type: asset.type,
      url: asset.url,
      metadata: asset.metadata_json,
    })),
    project: job.projects ? {
      id: job.projects.id,
      title: job.projects.title,
      niche: job.projects.niche_preset,
    } : null,
    createdAt: job.created_at,
    startedAt: job.started_at,
    finishedAt: job.finished_at,
  });
}

function getDefaultMessage(status: string): string {
  const messages: Record<string, string> = {
    queued: "Your video is in the queue...",
    scripting: "Writing your script...",
    scene_planning: "Planning scenes and visuals...",
    image_gen: "Generating images...",
    voice_gen: "Creating narration...",
    alignment: "Syncing captions...",
    rendering: "Rendering your video...",
    packaging: "Packaging your files...",
    ready: "Your video is ready!",
    failed: "Something went wrong",
  };
  return messages[status] || "Processing...";
}
