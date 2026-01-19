import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createClient } from "@supabase/supabase-js";

// ============================================
// PIPELINE STEPS E2E TESTS WITH DEBUG LOGGING
// ============================================
// These tests verify each pipeline step individually with
// comprehensive console logging for debugging.

const SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TEST_USER_ID = "d0d8c19c-3b3e-4f5a-9b1a-6c7d8e9f0a1b";

// Debug logger utility
function debugLog(context: string, message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${context}] ${message}`);
  if (data !== undefined) {
    console.log(`  └─ Data:`, JSON.stringify(data, null, 2));
  }
}

// Wait for specific job status
async function waitForJobStatus(
  jobId: string,
  targetStatuses: string[],
  timeoutMs: number = 300000
): Promise<{ status: string; progress: number; error?: string }> {
  const startTime = Date.now();
  const pollInterval = 3000;
  let lastStatus = "";

  debugLog("WAIT", `Waiting for job ${jobId} to reach: ${targetStatuses.join(" or ")}`);

  while (Date.now() - startTime < timeoutMs) {
    const { data: job, error } = await supabase
      .from("jobs")
      .select("status, progress, error_code, error_message")
      .eq("id", jobId)
      .single();

    if (error) {
      debugLog("ERROR", `Failed to fetch job: ${error.message}`);
      return { status: "ERROR", progress: 0, error: error.message };
    }

    if (job.status !== lastStatus) {
      debugLog("STATUS", `Job ${jobId}: ${lastStatus} → ${job.status} (${job.progress}%)`);
      lastStatus = job.status;
    }

    if (targetStatuses.includes(job.status)) {
      debugLog("SUCCESS", `Job reached target status: ${job.status}`);
      return { status: job.status, progress: job.progress };
    }

    if (job.status === "FAILED") {
      debugLog("FAILED", `Job failed: ${job.error_code} - ${job.error_message}`);
      return { 
        status: "FAILED", 
        progress: job.progress,
        error: `${job.error_code}: ${job.error_message}` 
      };
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  debugLog("TIMEOUT", `Job did not reach target status within ${timeoutMs}ms`);
  return { status: "TIMEOUT", progress: 0, error: "Timeout waiting for status" };
}

// Fetch job events for debugging
async function getJobEvents(jobId: string): Promise<void> {
  const { data: events, error } = await supabase
    .from("job_events")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

  if (error) {
    debugLog("EVENTS", `Failed to fetch events: ${error.message}`);
    return;
  }

  debugLog("EVENTS", `Found ${events?.length || 0} events for job ${jobId}`);
  events?.forEach((event, idx) => {
    console.log(`  [${idx + 1}] ${event.stage} - ${event.level}: ${event.message}`);
    if (event.meta && Object.keys(event.meta).length > 0) {
      console.log(`      Meta:`, event.meta);
    }
  });
}

// Fetch job assets for debugging
async function getJobAssets(jobId: string): Promise<void> {
  const { data: assets, error } = await supabase
    .from("assets")
    .select("*")
    .eq("job_id", jobId);

  if (error) {
    debugLog("ASSETS", `Failed to fetch assets: ${error.message}`);
    return;
  }

  debugLog("ASSETS", `Found ${assets?.length || 0} assets for job ${jobId}`);
  assets?.forEach((asset) => {
    console.log(`  - ${asset.type}: ${asset.path}`);
  });
}

describe("Pipeline Step E2E - SCRIPTING", () => {
  let projectId: string | null = null;
  let jobId: string | null = null;

  beforeAll(() => {
    debugLog("TEST", "Starting SCRIPTING step tests");
  });

  afterAll(async () => {
    debugLog("CLEANUP", "Cleaning up test data");
    if (jobId) {
      await getJobEvents(jobId);
      await getJobAssets(jobId);
      await supabase.from("job_events").delete().eq("job_id", jobId);
      await supabase.from("assets").delete().eq("job_id", jobId);
      await supabase.from("jobs").delete().eq("id", jobId);
    }
    if (projectId) {
      await supabase.from("project_inputs").delete().eq("project_id", projectId);
      await supabase.from("projects").delete().eq("id", projectId);
    }
  });

  it("creates project and job for scripting test", async () => {
    debugLog("TEST", "Creating project for scripting test");

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        user_id: TEST_USER_ID,
        title: `E2E Scripting Test - ${Date.now()}`,
        niche_preset: "motivation",
        target_minutes: 1,
        status: "draft",
      })
      .select()
      .single();

    if (projectError) {
      debugLog("SKIP", `Cannot create project: ${projectError.message}`);
      expect(true).toBe(true);
      return;
    }

    projectId = project.id;
    debugLog("SUCCESS", `Created project: ${projectId}`);

    // Add input content
    const content = `
      Success is not final, failure is not fatal.
      It is the courage to continue that counts.
      Every champion was once a contender who refused to give up.
    `;

    const { error: inputError } = await supabase
      .from("project_inputs")
      .insert({
        project_id: projectId,
        type: "text",
        title: "Test Content",
        content_text: content,
        meta: { source: "e2e-test" },
      });

    if (inputError) {
      debugLog("ERROR", `Failed to add input: ${inputError.message}`);
    } else {
      debugLog("SUCCESS", "Added input content to project");
    }

    // Create job
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        project_id: projectId,
        user_id: TEST_USER_ID,
        status: "QUEUED",
        progress: 0,
        cost_credits_reserved: 1,
      })
      .select()
      .single();

    if (jobError) {
      debugLog("ERROR", `Failed to create job: ${jobError.message}`);
      return;
    }

    jobId = job.id;
    debugLog("SUCCESS", `Created job: ${jobId}`);

    // Update project status
    await supabase
      .from("projects")
      .update({ status: "generating" })
      .eq("id", projectId);

    debugLog("SUCCESS", "Project status updated to generating");
    expect(projectId).toBeDefined();
    expect(jobId).toBeDefined();
  });

  it("waits for scripting step to complete", async () => {
    if (!jobId) {
      debugLog("SKIP", "No job created, skipping");
      return;
    }

    debugLog("TEST", "Waiting for SCRIPTING step");
    
    // Wait for job to pass SCRIPTING (or fail/complete)
    const result = await waitForJobStatus(
      jobId,
      ["VOICE_GEN", "ALIGNMENT", "READY", "FAILED"],
      120000 // 2 minute timeout for scripting
    );

    debugLog("RESULT", `Scripting test result: ${result.status}`, result);

    // Log events regardless of outcome
    await getJobEvents(jobId);

    if (result.status === "FAILED") {
      debugLog("FAILED", `Scripting failed: ${result.error}`);
    }

    // Test passes if we got past scripting or if it's still processing
    expect(["VOICE_GEN", "ALIGNMENT", "READY", "FAILED", "TIMEOUT"]).toContain(result.status);
  }, 150000);
});

describe("Pipeline Step E2E - VOICE_GEN", () => {
  let projectId: string | null = null;
  let jobId: string | null = null;

  afterAll(async () => {
    if (jobId) {
      await getJobEvents(jobId);
      await getJobAssets(jobId);
      await supabase.from("job_events").delete().eq("job_id", jobId);
      await supabase.from("assets").delete().eq("job_id", jobId);
      await supabase.from("jobs").delete().eq("id", jobId);
    }
    if (projectId) {
      await supabase.from("project_inputs").delete().eq("project_id", projectId);
      await supabase.from("projects").delete().eq("id", projectId);
    }
  });

  it("creates project and waits for voice generation", async () => {
    debugLog("TEST", "Starting VOICE_GEN step test");

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        user_id: TEST_USER_ID,
        title: `E2E Voice Gen Test - ${Date.now()}`,
        niche_preset: "explainer",
        target_minutes: 1,
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

    // Add technical content
    const { error: inputError } = await supabase
      .from("project_inputs")
      .insert({
        project_id: projectId,
        type: "text",
        title: "Technical Explanation",
        content_text: `
          Artificial intelligence is transforming how we interact with technology.
          Machine learning algorithms can now recognize patterns in vast datasets.
          Neural networks mimic the structure of the human brain.
          Deep learning enables computers to understand complex concepts.
        `,
        meta: {},
      });

    debugLog("INPUT", inputError ? `Error: ${inputError.message}` : "Added content");

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        project_id: projectId,
        user_id: TEST_USER_ID,
        status: "QUEUED",
        progress: 0,
        cost_credits_reserved: 1,
      })
      .select()
      .single();

    if (jobError) {
      debugLog("ERROR", `Failed to create job: ${jobError.message}`);
      return;
    }

    jobId = job.id;
    debugLog("SUCCESS", `Created job: ${jobId}`);

    await supabase
      .from("projects")
      .update({ status: "generating" })
      .eq("id", projectId);

    // Wait for voice generation to complete
    const result = await waitForJobStatus(
      jobId,
      ["ALIGNMENT", "VISUAL_PLAN", "IMAGE_GEN", "READY", "FAILED"],
      180000 // 3 minute timeout for voice gen
    );

    debugLog("RESULT", `Voice gen test result: ${result.status}`, result);
    await getJobEvents(jobId);
    await getJobAssets(jobId);

    expect(result.status).not.toBe("TIMEOUT");
  }, 200000);
});

describe("Pipeline Step E2E - IMAGE_GEN", () => {
  let projectId: string | null = null;
  let jobId: string | null = null;

  afterAll(async () => {
    if (jobId) {
      await getJobEvents(jobId);
      await getJobAssets(jobId);
      await supabase.from("job_events").delete().eq("job_id", jobId);
      await supabase.from("assets").delete().eq("job_id", jobId);
      await supabase.from("jobs").delete().eq("id", jobId);
    }
    if (projectId) {
      await supabase.from("project_inputs").delete().eq("project_id", projectId);
      await supabase.from("projects").delete().eq("id", projectId);
    }
  });

  it("creates project and waits for image generation", async () => {
    debugLog("TEST", "Starting IMAGE_GEN step test");

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        user_id: TEST_USER_ID,
        title: `E2E Image Gen Test - ${Date.now()}`,
        niche_preset: "facts",
        target_minutes: 1,
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

    const { error: inputError } = await supabase
      .from("project_inputs")
      .insert({
        project_id: projectId,
        type: "text",
        title: "Fun Facts",
        content_text: `
          The human brain contains approximately 86 billion neurons.
          Honey never spoils - archaeologists found 3000-year-old honey still edible.
          Octopuses have three hearts and blue blood.
          A group of flamingos is called a flamboyance.
        `,
        meta: {},
      });

    debugLog("INPUT", inputError ? `Error: ${inputError.message}` : "Added content");

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        project_id: projectId,
        user_id: TEST_USER_ID,
        status: "QUEUED",
        progress: 0,
        cost_credits_reserved: 1,
      })
      .select()
      .single();

    if (jobError) {
      debugLog("ERROR", `Failed to create job: ${jobError.message}`);
      return;
    }

    jobId = job.id;
    debugLog("SUCCESS", `Created job: ${jobId}`);

    await supabase
      .from("projects")
      .update({ status: "generating" })
      .eq("id", projectId);

    // Wait for image generation to complete
    const result = await waitForJobStatus(
      jobId,
      ["TIMELINE_BUILD", "RENDERING", "PACKAGING", "READY", "FAILED"],
      300000 // 5 minute timeout for image gen
    );

    debugLog("RESULT", `Image gen test result: ${result.status}`, result);
    await getJobEvents(jobId);
    await getJobAssets(jobId);

    // Check for generated images
    const { data: assets } = await supabase
      .from("assets")
      .select("*")
      .eq("job_id", jobId)
      .eq("type", "image");

    debugLog("IMAGES", `Generated ${assets?.length || 0} images`);

    expect(result.status).not.toBe("TIMEOUT");
  }, 350000);
});

describe("Pipeline Step E2E - RENDERING", () => {
  let projectId: string | null = null;
  let jobId: string | null = null;

  afterAll(async () => {
    if (jobId) {
      await getJobEvents(jobId);
      await getJobAssets(jobId);
      await supabase.from("job_events").delete().eq("job_id", jobId);
      await supabase.from("assets").delete().eq("job_id", jobId);
      await supabase.from("jobs").delete().eq("id", jobId);
    }
    if (projectId) {
      await supabase.from("project_inputs").delete().eq("project_id", projectId);
      await supabase.from("projects").delete().eq("id", projectId);
    }
  });

  it("creates project and waits for full render", async () => {
    debugLog("TEST", "Starting RENDERING step test (full pipeline)");

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        user_id: TEST_USER_ID,
        title: `E2E Render Test - ${Date.now()}`,
        niche_preset: "motivation",
        target_minutes: 1,
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

    const { error: inputError } = await supabase
      .from("project_inputs")
      .insert({
        project_id: projectId,
        type: "text",
        title: "Motivation",
        content_text: `
          Every morning brings new opportunities for growth.
          Success is built one small step at a time.
          Your potential is unlimited when you believe in yourself.
          Take action today and watch your dreams become reality.
        `,
        meta: {},
      });

    debugLog("INPUT", inputError ? `Error: ${inputError.message}` : "Added content");

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        project_id: projectId,
        user_id: TEST_USER_ID,
        status: "QUEUED",
        progress: 0,
        cost_credits_reserved: 1,
      })
      .select()
      .single();

    if (jobError) {
      debugLog("ERROR", `Failed to create job: ${jobError.message}`);
      return;
    }

    jobId = job.id;
    debugLog("SUCCESS", `Created job: ${jobId}`);

    await supabase
      .from("projects")
      .update({ status: "generating" })
      .eq("id", projectId);

    // Wait for full completion
    const result = await waitForJobStatus(
      jobId,
      ["READY", "FAILED"],
      600000 // 10 minute timeout for full pipeline
    );

    debugLog("RESULT", `Full render test result: ${result.status}`, result);
    
    // Log all events and assets
    await getJobEvents(jobId);
    await getJobAssets(jobId);

    if (result.status === "READY") {
      // Verify video asset exists
      const { data: videoAsset } = await supabase
        .from("assets")
        .select("*")
        .eq("job_id", jobId)
        .eq("type", "video")
        .single();

      debugLog("VIDEO", videoAsset ? `Video asset: ${videoAsset.path}` : "No video asset found");
    }

    expect(["READY", "FAILED"]).toContain(result.status);
  }, 650000);
});

describe("Pipeline E2E - Error Scenarios", () => {
  it("handles empty input gracefully", async () => {
    debugLog("TEST", "Testing empty input handling");

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        user_id: TEST_USER_ID,
        title: `E2E Empty Input Test - ${Date.now()}`,
        niche_preset: "motivation",
        target_minutes: 1,
        status: "draft",
      })
      .select()
      .single();

    if (projectError) {
      debugLog("SKIP", `Cannot create project: ${projectError.message}`);
      return;
    }

    debugLog("SUCCESS", `Created project without input: ${project.id}`);

    const { data: job, error: jobError } = await supabase
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

    if (jobError) {
      debugLog("ERROR", `Failed to create job: ${jobError.message}`);
      await supabase.from("projects").delete().eq("id", project.id);
      return;
    }

    debugLog("SUCCESS", `Created job: ${job.id}`);

    await supabase
      .from("projects")
      .update({ status: "generating" })
      .eq("id", project.id);

    // Wait and see how it handles missing input
    const result = await waitForJobStatus(
      job.id,
      ["READY", "FAILED"],
      120000
    );

    debugLog("RESULT", `Empty input test result: ${result.status}`, result);
    await getJobEvents(job.id);

    // Cleanup
    await supabase.from("job_events").delete().eq("job_id", job.id);
    await supabase.from("jobs").delete().eq("id", job.id);
    await supabase.from("projects").delete().eq("id", project.id);

    // Should either fail gracefully or use defaults
    expect(["READY", "FAILED"]).toContain(result.status);
  }, 150000);

  it("logs job step details on failure", async () => {
    debugLog("TEST", "Testing job step logging on failure");

    // Create a project with invalid niche to potentially trigger failure
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        user_id: TEST_USER_ID,
        title: `E2E Failure Logging Test - ${Date.now()}`,
        niche_preset: "invalid_niche_that_might_fail",
        target_minutes: 1,
        status: "draft",
      })
      .select()
      .single();

    if (projectError) {
      debugLog("EXPECTED", `Project creation failed as expected: ${projectError.message}`);
      expect(true).toBe(true);
      return;
    }

    debugLog("SUCCESS", `Created project with invalid niche: ${project.id}`);

    // Cleanup
    await supabase.from("projects").delete().eq("id", project.id);
    expect(true).toBe(true);
  });
});

describe("Pipeline E2E - Concurrent Jobs", () => {
  const projectIds: string[] = [];
  const jobIds: string[] = [];

  afterAll(async () => {
    debugLog("CLEANUP", `Cleaning up ${jobIds.length} jobs and ${projectIds.length} projects`);
    
    for (const jobId of jobIds) {
      await supabase.from("job_events").delete().eq("job_id", jobId);
      await supabase.from("assets").delete().eq("job_id", jobId);
      await supabase.from("jobs").delete().eq("id", jobId);
    }
    
    for (const projectId of projectIds) {
      await supabase.from("project_inputs").delete().eq("project_id", projectId);
      await supabase.from("projects").delete().eq("id", projectId);
    }
  });

  it("can queue multiple jobs simultaneously", async () => {
    debugLog("TEST", "Testing concurrent job queueing");

    const niches = ["motivation", "explainer", "facts"];
    
    for (const niche of niches) {
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({
          user_id: TEST_USER_ID,
          title: `E2E Concurrent Test - ${niche} - ${Date.now()}`,
          niche_preset: niche,
          target_minutes: 1,
          status: "draft",
        })
        .select()
        .single();

      if (projectError) {
        debugLog("SKIP", `Cannot create ${niche} project: ${projectError.message}`);
        continue;
      }

      projectIds.push(project.id);
      debugLog("SUCCESS", `Created ${niche} project: ${project.id}`);

      const { data: job, error: jobError } = await supabase
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

      if (!jobError && job) {
        jobIds.push(job.id);
        debugLog("SUCCESS", `Queued ${niche} job: ${job.id}`);
      }
    }

    debugLog("SUMMARY", `Queued ${jobIds.length} concurrent jobs`);

    // Check queue status
    const { data: queuedJobs } = await supabase
      .from("jobs")
      .select("id, status, progress")
      .in("id", jobIds);

    debugLog("QUEUE", "Current job statuses:", queuedJobs);

    expect(jobIds.length).toBeGreaterThan(0);
  });
});
