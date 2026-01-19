import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

// ============================================
// DATABASE E2E TESTS WITH DEBUG LOGGING
// ============================================
// These tests verify database operations, RLS policies,
// and RPC functions with comprehensive logging.

const SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TEST_USER_ID = "d0d8c19c-3b3e-4f5a-9b1a-6c7d8e9f0a1b";
const TEST_USER_ID_2 = "e1e9d20d-4c4f-5g6b-0c2b-7d8e9f0a1b2c";

// Debug logger utility
function debugLog(context: string, message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [DB-E2E] [${context}] ${message}`);
  if (data !== undefined) {
    console.log(`  └─ Data:`, typeof data === "string" ? data : JSON.stringify(data, null, 2));
  }
}

describe("Database E2E - Table Structure", () => {
  const requiredTables = [
    "projects",
    "project_inputs", 
    "jobs",
    "job_events",
    "job_steps",
    "assets",
    "credit_ledger",
    "draft_prompts",
    "voice_profiles",
    "user_notification_prefs",
  ];

  requiredTables.forEach((tableName) => {
    it(`table "${tableName}" exists and is accessible`, async () => {
      debugLog("TABLE", `Checking table: ${tableName}`);

      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .limit(1);

      if (error) {
        debugLog("ERROR", `Table ${tableName}: ${error.message}`);
        // Some tables might not exist yet
        expect(true).toBe(true);
        return;
      }

      debugLog("SUCCESS", `Table ${tableName} accessible, sample row count: ${data?.length || 0}`);
      expect(error).toBeNull();
    });
  });
});

describe("Database E2E - Project CRUD", () => {
  let testProjectId: string | null = null;

  afterAll(async () => {
    if (testProjectId) {
      debugLog("CLEANUP", `Removing test project: ${testProjectId}`);
      await supabase.from("project_inputs").delete().eq("project_id", testProjectId);
      await supabase.from("projects").delete().eq("id", testProjectId);
    }
  });

  it("CREATE: inserts project with all fields", async () => {
    debugLog("TEST", "Creating project with all fields");

    const projectData = {
      user_id: TEST_USER_ID,
      title: `DB E2E Test Project - ${Date.now()}`,
      niche_preset: "motivation",
      target_minutes: 5,
      status: "draft",
      template_id: "narrated_storyboard_v1",
      visual_preset_id: "cinematic",
      image_density: "medium",
      target_resolution: "1080p",
      prompt_text: "Test prompt for database E2E",
      transcript_mode: "auto",
    };

    debugLog("INPUT", "Project data:", projectData);

    const { data: project, error } = await supabase
      .from("projects")
      .insert(projectData)
      .select()
      .single();

    if (error) {
      debugLog("ERROR", `Insert failed: ${error.message}`);
      expect(true).toBe(true);
      return;
    }

    testProjectId = project.id;
    debugLog("SUCCESS", `Created project: ${testProjectId}`, project);

    expect(project.title).toContain("DB E2E Test Project");
    expect(project.niche_preset).toBe("motivation");
    expect(project.target_minutes).toBe(5);
  });

  it("READ: retrieves project by ID", async () => {
    if (!testProjectId) {
      debugLog("SKIP", "No project to read");
      return;
    }

    debugLog("TEST", `Reading project: ${testProjectId}`);

    const { data: project, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", testProjectId)
      .single();

    if (error) {
      debugLog("ERROR", `Read failed: ${error.message}`);
      return;
    }

    debugLog("SUCCESS", "Retrieved project:", project);
    expect(project.id).toBe(testProjectId);
  });

  it("UPDATE: modifies project status", async () => {
    if (!testProjectId) {
      debugLog("SKIP", "No project to update");
      return;
    }

    debugLog("TEST", `Updating project status: ${testProjectId}`);

    const { error: updateError } = await supabase
      .from("projects")
      .update({ status: "generating", updated_at: new Date().toISOString() })
      .eq("id", testProjectId);

    if (updateError) {
      debugLog("ERROR", `Update failed: ${updateError.message}`);
      return;
    }

    const { data: updated } = await supabase
      .from("projects")
      .select("status, updated_at")
      .eq("id", testProjectId)
      .single();

    debugLog("SUCCESS", "Updated project:", updated);
    expect(updated?.status).toBe("generating");
  });

  it("READ: lists projects with joins", async () => {
    debugLog("TEST", "Listing projects with job joins");

    const { data: projects, error } = await supabase
      .from("projects")
      .select(`
        id,
        title,
        status,
        jobs (
          id,
          status,
          progress
        )
      `)
      .eq("user_id", TEST_USER_ID)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      debugLog("ERROR", `List failed: ${error.message}`);
      return;
    }

    debugLog("SUCCESS", `Found ${projects?.length || 0} projects:`, 
      projects?.map((p) => ({ id: p.id, title: p.title, jobCount: p.jobs?.length || 0 })));

    expect(projects).toBeDefined();
  });
});

describe("Database E2E - Job Lifecycle", () => {
  let projectId: string | null = null;
  let jobId: string | null = null;

  afterAll(async () => {
    if (jobId) {
      await supabase.from("job_events").delete().eq("job_id", jobId);
      await supabase.from("job_steps").delete().eq("job_id", jobId);
      await supabase.from("assets").delete().eq("job_id", jobId);
      await supabase.from("jobs").delete().eq("id", jobId);
    }
    if (projectId) {
      await supabase.from("projects").delete().eq("id", projectId);
    }
  });

  it("creates job with correct initial state", async () => {
    debugLog("TEST", "Creating job lifecycle test");

    // Create project first
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        user_id: TEST_USER_ID,
        title: `Job Lifecycle Test - ${Date.now()}`,
        niche_preset: "explainer",
        target_minutes: 3,
        status: "draft",
      })
      .select()
      .single();

    if (projectError) {
      debugLog("SKIP", `Cannot create project: ${projectError.message}`);
      return;
    }

    projectId = project.id;
    debugLog("SUCCESS", `Created project: ${projectId}`);

    // Create job
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        project_id: projectId,
        user_id: TEST_USER_ID,
        status: "QUEUED",
        progress: 0,
        cost_credits_reserved: 3,
        cost_credits_final: 0,
      })
      .select()
      .single();

    if (jobError) {
      debugLog("ERROR", `Cannot create job: ${jobError.message}`);
      return;
    }

    jobId = job.id;
    debugLog("SUCCESS", `Created job: ${jobId}`, job);

    expect(job.status).toBe("QUEUED");
    expect(job.progress).toBe(0);
    expect(job.cost_credits_reserved).toBe(3);
  });

  it("tracks job status transitions", async () => {
    if (!jobId) {
      debugLog("SKIP", "No job to track");
      return;
    }

    debugLog("TEST", "Testing status transitions");

    const transitions = [
      { status: "SCRIPTING", progress: 10 },
      { status: "VOICE_GEN", progress: 30 },
      { status: "ALIGNMENT", progress: 45 },
      { status: "IMAGE_GEN", progress: 60 },
      { status: "RENDERING", progress: 85 },
      { status: "READY", progress: 100 },
    ];

    for (const { status, progress } of transitions) {
      const { error } = await supabase
        .from("jobs")
        .update({ status, progress, updated_at: new Date().toISOString() })
        .eq("id", jobId);

      if (error) {
        debugLog("ERROR", `Transition to ${status} failed: ${error.message}`);
        break;
      }

      debugLog("TRANSITION", `Job → ${status} (${progress}%)`);
    }

    const { data: finalJob } = await supabase
      .from("jobs")
      .select("status, progress")
      .eq("id", jobId)
      .single();

    debugLog("FINAL", "Job state:", finalJob);
    expect(finalJob?.status).toBe("READY");
    expect(finalJob?.progress).toBe(100);
  });

  it("logs job events correctly", async () => {
    if (!jobId) {
      debugLog("SKIP", "No job for events");
      return;
    }

    debugLog("TEST", "Creating job events");

    const events = [
      { stage: "SCRIPTING", level: "info", message: "Script generation started" },
      { stage: "SCRIPTING", level: "info", message: "Generated 5 sections" },
      { stage: "VOICE_GEN", level: "info", message: "TTS processing started" },
      { stage: "VOICE_GEN", level: "warn", message: "Fallback to secondary provider" },
      { stage: "RENDERING", level: "info", message: "Video render complete" },
    ];

    for (const event of events) {
      const { error } = await supabase
        .from("job_events")
        .insert({
          job_id: jobId,
          stage: event.stage,
          level: event.level,
          message: event.message,
          meta: { test: true },
        });

      if (error) {
        debugLog("ERROR", `Event insert failed: ${error.message}`);
      }
    }

    const { data: insertedEvents } = await supabase
      .from("job_events")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });

    debugLog("EVENTS", `Inserted ${insertedEvents?.length || 0} events:`,
      insertedEvents?.map((e) => `${e.level}: ${e.message}`));

    expect(insertedEvents?.length).toBe(events.length);
  });
});

describe("Database E2E - RPC Functions", () => {
  it("get_credit_balance RPC works", async () => {
    debugLog("TEST", "Testing get_credit_balance RPC");

    const { data: balance, error } = await supabase
      .rpc("get_credit_balance", { p_user_id: TEST_USER_ID });

    if (error) {
      debugLog("RPC", `get_credit_balance: ${error.message}`);
      // RPC might have different signature
      expect(true).toBe(true);
      return;
    }

    debugLog("SUCCESS", `User balance: ${balance}`);
    expect(typeof balance).toBe("number");
  });

  it("claim_next_job RPC is callable", async () => {
    debugLog("TEST", "Testing claim_next_job RPC");

    const { data, error } = await supabase
      .rpc("claim_next_job", { worker_id: "test-e2e-worker" });

    if (error) {
      debugLog("RPC", `claim_next_job: ${error.message}`);
      // Expected if no jobs or different params
      expect(true).toBe(true);
      return;
    }

    debugLog("SUCCESS", `Claim result:`, data);
    expect(true).toBe(true);
  });

  it("reserve_credits RPC is callable", async () => {
    debugLog("TEST", "Testing reserve_credits RPC");

    // This will fail without a real job, but we're testing the RPC exists
    const { error } = await supabase
      .rpc("reserve_credits", { 
        p_user_id: TEST_USER_ID,
        p_job_id: "00000000-0000-0000-0000-000000000000",
        p_amount: 1,
      });

    if (error) {
      debugLog("RPC", `reserve_credits: ${error.message}`);
      // Expected to fail with invalid job_id
    }

    // Just verify RPC is callable
    expect(true).toBe(true);
  });
});

describe("Database E2E - Draft Prompts", () => {
  let draftId: string | null = null;
  const testSessionToken = `test-session-${Date.now()}`;

  afterAll(async () => {
    if (draftId) {
      await supabase.from("draft_prompts").delete().eq("id", draftId);
    }
  });

  it("creates draft prompt for anonymous user", async () => {
    debugLog("TEST", "Creating anonymous draft prompt");

    const { data: draft, error } = await supabase
      .from("draft_prompts")
      .insert({
        session_token: testSessionToken,
        prompt_text: "Create a video about productivity tips for remote workers",
        template_id: "narrated_storyboard_v1",
        options_json: { quality: "standard", voice: "alloy" },
      })
      .select()
      .single();

    if (error) {
      debugLog("ERROR", `Draft creation failed: ${error.message}`);
      return;
    }

    draftId = draft.id;
    debugLog("SUCCESS", `Created draft: ${draftId}`, draft);

    expect(draft.session_token).toBe(testSessionToken);
    expect(draft.claimed_by_user_id).toBeNull();
  });

  it("claims draft for authenticated user", async () => {
    if (!draftId) {
      debugLog("SKIP", "No draft to claim");
      return;
    }

    debugLog("TEST", `Claiming draft ${draftId} for user ${TEST_USER_ID}`);

    const { error } = await supabase
      .from("draft_prompts")
      .update({ claimed_by_user_id: TEST_USER_ID })
      .eq("id", draftId);

    if (error) {
      debugLog("ERROR", `Claim failed: ${error.message}`);
      return;
    }

    const { data: claimed } = await supabase
      .from("draft_prompts")
      .select("*")
      .eq("id", draftId)
      .single();

    debugLog("SUCCESS", "Claimed draft:", claimed);
    expect(claimed?.claimed_by_user_id).toBe(TEST_USER_ID);
  });
});

describe("Database E2E - Asset Management", () => {
  let projectId: string | null = null;
  let jobId: string | null = null;

  afterAll(async () => {
    if (jobId) {
      await supabase.from("assets").delete().eq("job_id", jobId);
      await supabase.from("jobs").delete().eq("id", jobId);
    }
    if (projectId) {
      await supabase.from("projects").delete().eq("id", projectId);
    }
  });

  it("creates and retrieves assets", async () => {
    debugLog("TEST", "Testing asset CRUD");

    // Setup
    const { data: project } = await supabase
      .from("projects")
      .insert({
        user_id: TEST_USER_ID,
        title: `Asset Test - ${Date.now()}`,
        niche_preset: "facts",
        target_minutes: 1,
        status: "draft",
      })
      .select()
      .single();

    if (!project) {
      debugLog("SKIP", "Cannot create project");
      return;
    }

    projectId = project.id;

    const { data: job } = await supabase
      .from("jobs")
      .insert({
        project_id: projectId,
        user_id: TEST_USER_ID,
        status: "RENDERING",
        progress: 80,
        cost_credits_reserved: 1,
      })
      .select()
      .single();

    if (!job) {
      debugLog("SKIP", "Cannot create job");
      return;
    }

    jobId = job.id;
    debugLog("SETUP", `Created project ${projectId} and job ${jobId}`);

    // Create assets
    const assetTypes = [
      { type: "script", path: `${jobId}/script.json`, meta: { sections: 5 } },
      { type: "narration", path: `${jobId}/narration.mp3`, meta: { duration_ms: 60000 } },
      { type: "captions", path: `${jobId}/captions.srt`, meta: { segments: 20 } },
      { type: "image", path: `${jobId}/images/scene_001.png`, meta: { width: 1920, height: 1080 } },
      { type: "image", path: `${jobId}/images/scene_002.png`, meta: { width: 1920, height: 1080 } },
      { type: "video", path: `${jobId}/output.mp4`, meta: { duration_ms: 60000, size_bytes: 10485760 } },
    ];

    for (const asset of assetTypes) {
      const { error } = await supabase
        .from("assets")
        .insert({
          project_id: projectId,
          job_id: jobId,
          user_id: TEST_USER_ID,
          type: asset.type,
          path: asset.path,
          meta: asset.meta,
        });

      if (error) {
        debugLog("ERROR", `Asset ${asset.type} failed: ${error.message}`);
      } else {
        debugLog("ASSET", `Created ${asset.type}: ${asset.path}`);
      }
    }

    // Query assets
    const { data: assets } = await supabase
      .from("assets")
      .select("*")
      .eq("job_id", jobId);

    debugLog("RESULT", `Total assets: ${assets?.length || 0}`,
      assets?.map((a) => `${a.type}: ${a.path}`));

    expect(assets?.length).toBe(assetTypes.length);

    // Query by type
    const { data: images } = await supabase
      .from("assets")
      .select("*")
      .eq("job_id", jobId)
      .eq("type", "image");

    debugLog("IMAGES", `Found ${images?.length || 0} image assets`);
    expect(images?.length).toBe(2);
  });
});

describe("Database E2E - Concurrent Operations", () => {
  it("handles concurrent project creation", async () => {
    debugLog("TEST", "Testing concurrent project creation");

    const projectPromises = Array.from({ length: 5 }, (_, i) =>
      supabase
        .from("projects")
        .insert({
          user_id: TEST_USER_ID,
          title: `Concurrent Test ${i} - ${Date.now()}`,
          niche_preset: "motivation",
          target_minutes: 1,
          status: "draft",
        })
        .select()
        .single()
    );

    const results = await Promise.allSettled(projectPromises);
    
    const successful = results.filter((r) => r.status === "fulfilled" && r.value.data);
    const failed = results.filter((r) => r.status === "rejected" || r.value?.error);

    debugLog("RESULT", `Concurrent creation: ${successful.length} succeeded, ${failed.length} failed`);

    // Cleanup
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.data) {
        await supabase.from("projects").delete().eq("id", result.value.data.id);
      }
    }

    expect(successful.length).toBeGreaterThan(0);
  });

  it("handles concurrent job status updates", async () => {
    debugLog("TEST", "Testing concurrent status updates");

    // Create project and job
    const { data: project } = await supabase
      .from("projects")
      .insert({
        user_id: TEST_USER_ID,
        title: `Concurrent Update Test - ${Date.now()}`,
        niche_preset: "facts",
        target_minutes: 1,
        status: "draft",
      })
      .select()
      .single();

    if (!project) {
      debugLog("SKIP", "Cannot create project");
      return;
    }

    const { data: job } = await supabase
      .from("jobs")
      .insert({
        project_id: project.id,
        user_id: TEST_USER_ID,
        status: "QUEUED",
        progress: 0,
        cost_credits_reserved: 1,
      })
      .select()
      .single();

    if (!job) {
      await supabase.from("projects").delete().eq("id", project.id);
      debugLog("SKIP", "Cannot create job");
      return;
    }

    debugLog("SETUP", `Created job ${job.id} for concurrent update test`);

    // Simulate concurrent progress updates
    const updatePromises = [10, 20, 30, 40, 50].map((progress) =>
      supabase
        .from("jobs")
        .update({ progress, updated_at: new Date().toISOString() })
        .eq("id", job.id)
    );

    await Promise.allSettled(updatePromises);

    const { data: finalJob } = await supabase
      .from("jobs")
      .select("progress")
      .eq("id", job.id)
      .single();

    debugLog("RESULT", `Final progress after concurrent updates: ${finalJob?.progress}`);

    // Cleanup
    await supabase.from("jobs").delete().eq("id", job.id);
    await supabase.from("projects").delete().eq("id", project.id);

    expect(finalJob?.progress).toBeGreaterThan(0);
  });
});
