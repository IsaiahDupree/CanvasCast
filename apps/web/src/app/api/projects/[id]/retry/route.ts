import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/projects/:id/retry
 * Retries a failed job from its checkpoint if available
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const projectId = params.id;

    // Fetch project to verify ownership
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*, jobs(*)")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Find the most recent failed job
    const failedJob = project.jobs
      ?.filter((j: any) => j.status === "FAILED")
      .sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];

    if (!failedJob) {
      return NextResponse.json(
        { error: "No failed job found for this project" },
        { status: 400 }
      );
    }

    // Check if checkpoint exists
    const { data: jobData } = await supabase
      .from("jobs")
      .select("checkpoint_state")
      .eq("id", failedJob.id)
      .single();

    const checkpoint = jobData?.checkpoint_state;
    const canRetryFromCheckpoint = checkpoint &&
      ["IMAGE_GEN", "TIMELINE_BUILD", "RENDERING", "PACKAGING"].includes(checkpoint.lastCompletedStep);

    // Get credit balance
    const { data: balanceData } = await supabase.rpc("get_credit_balance", {
      p_user_id: user.id,
    });

    const available = balanceData?.available || 0;

    // For checkpoint retry, we only charge for remaining steps (reduced cost)
    // For full retry, we charge full estimated cost
    const estimatedCost = canRetryFromCheckpoint ? 1 : project.target_minutes;

    if (available < estimatedCost) {
      return NextResponse.json(
        { error: "Insufficient credits", required: estimatedCost, available },
        { status: 402 }
      );
    }

    // Reserve credits for retry
    const { data: reserveData, error: reserveError } = await supabase.rpc(
      "reserve_credits",
      {
        p_user_id: user.id,
        p_amount: estimatedCost,
        p_reason: canRetryFromCheckpoint
          ? `Retry from checkpoint for project ${projectId}`
          : `Full retry for project ${projectId}`,
      }
    );

    if (reserveError || !reserveData) {
      return NextResponse.json(
        { error: "Failed to reserve credits" },
        { status: 500 }
      );
    }

    // Create new job for retry
    const { data: newJob, error: jobError } = await supabase
      .from("jobs")
      .insert({
        project_id: projectId,
        user_id: user.id,
        status: "PENDING",
        progress: 0,
        cost_credits_reserved: estimatedCost,
        // If retrying from checkpoint, copy the checkpoint state
        checkpoint_state: canRetryFromCheckpoint ? checkpoint : null,
      })
      .select()
      .single();

    if (jobError || !newJob) {
      // Release reserved credits
      await supabase.rpc("release_job_credits", { p_job_id: failedJob.id });
      return NextResponse.json(
        { error: "Failed to create retry job" },
        { status: 500 }
      );
    }

    // Update project status
    await supabase
      .from("projects")
      .update({ status: "processing" })
      .eq("id", projectId);

    // TODO: Queue the job in BullMQ
    // For now, the worker will pick it up based on status

    return NextResponse.json({
      success: true,
      job: newJob,
      retryType: canRetryFromCheckpoint ? "checkpoint" : "full",
      checkpoint: canRetryFromCheckpoint ? {
        lastCompletedStep: checkpoint.lastCompletedStep,
        message: `Retrying from ${checkpoint.lastCompletedStep} step`,
      } : null,
    });
  } catch (error) {
    console.error("[API] Retry error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
