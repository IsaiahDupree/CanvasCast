import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const CreateProjectSchema = z.object({
  title: z.string().min(1).max(200),
  niche_preset: z.string().min(1),
  target_minutes: z.number().int().min(1).max(30).default(10),
  voice_profile_id: z.string().uuid().optional(),
  prompt_text: z.string().optional(),
  transcript_mode: z.enum(["auto", "manual"]).default("auto"),
  transcript_text: z.string().optional(),
  template_id: z.string().default("narrated_storyboard_v1"),
});

export async function GET() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: projects, error } = await supabase
    .from("projects")
    .select("*, jobs(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = CreateProjectSchema.safeParse(body);
  
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, niche_preset, target_minutes, voice_profile_id, prompt_text, transcript_mode, transcript_text, template_id } = parsed.data;
  const creditsRequired = target_minutes; // 1 credit per minute

  // Check credit balance
  const { data: balance, error: balanceError } = await supabase
    .rpc("get_credit_balance", { p_user_id: user.id });

  if (balanceError) {
    return NextResponse.json({ error: "Failed to check credit balance" }, { status: 500 });
  }

  if ((balance ?? 0) < creditsRequired) {
    return NextResponse.json({
      error: "Insufficient credits",
      required: creditsRequired,
      available: balance ?? 0,
    }, { status: 402 });
  }

  // Create project with PRD fields
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      title,
      niche_preset,
      target_minutes,
      prompt_text,
      transcript_mode,
      transcript_text,
      template_id,
      status: "generating",
    })
    .select()
    .single();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }

  // Create job
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      project_id: project.id,
      user_id: user.id,
      status: "QUEUED",
      cost_credits_reserved: creditsRequired,
    })
    .select()
    .single();

  if (jobError) {
    // Cleanup project
    await supabase.from("projects").delete().eq("id", project.id);
    return NextResponse.json({ error: jobError.message }, { status: 500 });
  }

  // Reserve credits
  const { error: reserveError } = await supabase.rpc("reserve_credits", {
    p_user_id: user.id,
    p_job_id: job.id,
    p_amount: creditsRequired,
  });

  if (reserveError) {
    // Cleanup
    await supabase.from("jobs").delete().eq("id", job.id);
    await supabase.from("projects").delete().eq("id", project.id);
    return NextResponse.json({
      error: "Failed to reserve credits",
      details: reserveError.message,
    }, { status: 402 });
  }

  // Store additional job metadata if provided
  if (prompt_text || voice_profile_id) {
    await supabase.from("assets").insert({
      project_id: project.id,
      user_id: user.id,
      job_id: job.id,
      type: "other",
      path: "input_metadata",
      meta: { prompt_text, transcript_mode, transcript_text, voice_profile_id },
    });
  }

  return NextResponse.json({
    project: { ...project, jobs: [job] },
    job,
    credits_reserved: creditsRequired,
  }, { status: 201 });
}
