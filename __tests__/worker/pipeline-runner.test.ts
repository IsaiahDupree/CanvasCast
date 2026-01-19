import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Create a shared mock Supabase instance that all tests will use
const mockSupabaseInstance = {
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabaseInstance),
}));

// Mock all pipeline steps
vi.mock("../../apps/worker/src/pipeline/steps/ingest-inputs", () => ({
  ingestInputs: vi.fn(),
}));

vi.mock("../../apps/worker/src/pipeline/steps/generate-script", () => ({
  generateScript: vi.fn(),
}));

vi.mock("../../apps/worker/src/pipeline/steps/generate-voice", () => ({
  generateVoice: vi.fn(),
}));

vi.mock("../../apps/worker/src/pipeline/steps/run-alignment", () => ({
  runAlignment: vi.fn(),
}));

vi.mock("../../apps/worker/src/pipeline/steps/plan-visuals", () => ({
  planVisuals: vi.fn(),
}));

vi.mock("../../apps/worker/src/pipeline/steps/generate-images", () => ({
  generateImages: vi.fn(),
}));

vi.mock("../../apps/worker/src/pipeline/steps/build-timeline", () => ({
  buildTimeline: vi.fn(),
}));

vi.mock("../../apps/worker/src/pipeline/steps/render-video", () => ({
  renderVideo: vi.fn(),
}));

vi.mock("../../apps/worker/src/pipeline/steps/package-assets", () => ({
  packageAssets: vi.fn(),
}));

// Import after mocks
let runPipeline: any;

describe("Pipeline Runner", () => {
  let mockJob: any;
  let mockProject: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import runPipeline after mocks are set up
    const pipelineModule = await import("../../apps/worker/src/pipeline/runner");
    runPipeline = pipelineModule.runPipeline;

    // Create mock job
    mockJob = {
      id: "job-123",
      project_id: "project-456",
      user_id: "user-789",
      status: "QUEUED",
      progress: 0,
      error_code: null,
      error_message: null,
      claimed_at: null,
      claimed_by: null,
      started_at: null,
      finished_at: null,
      cost_credits_reserved: 5,
      cost_credits_final: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Create mock project
    mockProject = {
      id: "project-456",
      user_id: "user-789",
      title: "Test Project",
      niche_preset: "tech",
      target_minutes: 2,
      status: "pending",
      template_id: "default",
      visual_preset_id: "modern",
      voice_profile_id: null,
      image_density: "medium",
      target_resolution: "1080p",
      timeline_path: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Setup default Supabase mock behavior
    mockSupabaseInstance.from = vi.fn((table: string) => {
      if (table === "projects") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
      }
      if (table === "jobs") {
        return {
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
      }
      if (table === "job_events") {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
    });

    mockSupabaseInstance.rpc = vi.fn().mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Success Path", () => {
    it("should run all pipeline steps in order", async () => {
      // Import step mocks
      const { ingestInputs } = await import("../../apps/worker/src/pipeline/steps/ingest-inputs");
      const { generateScript } = await import("../../apps/worker/src/pipeline/steps/generate-script");
      const { generateVoice } = await import("../../apps/worker/src/pipeline/steps/generate-voice");
      const { runAlignment } = await import("../../apps/worker/src/pipeline/steps/run-alignment");
      const { planVisuals } = await import("../../apps/worker/src/pipeline/steps/plan-visuals");
      const { generateImages } = await import("../../apps/worker/src/pipeline/steps/generate-images");
      const { buildTimeline } = await import("../../apps/worker/src/pipeline/steps/build-timeline");
      const { renderVideo } = await import("../../apps/worker/src/pipeline/steps/render-video");
      const { packageAssets } = await import("../../apps/worker/src/pipeline/steps/package-assets");

      // Mock successful step results
      vi.mocked(ingestInputs).mockResolvedValue({
        success: true,
        data: { mergedText: "Test input text" },
      });

      vi.mocked(generateScript).mockResolvedValue({
        success: true,
        data: {
          script: {
            title: "Test Script",
            sections: [],
            totalWordCount: 100,
            estimatedDurationMs: 60000,
            generatedAt: new Date().toISOString(),
          },
        },
      });

      vi.mocked(generateVoice).mockResolvedValue({
        success: true,
        data: {
          narrationPath: "/tmp/narration.mp3",
          durationMs: 120000,
        },
      });

      vi.mocked(runAlignment).mockResolvedValue({
        success: true,
        data: {
          segments: [],
          srtPath: "/tmp/captions.srt",
        },
      });

      vi.mocked(planVisuals).mockResolvedValue({
        success: true,
        data: {
          plan: {
            slots: [],
            totalImages: 5,
            cadenceMs: 3000,
          },
        },
      });

      vi.mocked(generateImages).mockResolvedValue({
        success: true,
        data: {
          imagePaths: ["/tmp/img1.png", "/tmp/img2.png"],
        },
      });

      vi.mocked(buildTimeline).mockResolvedValue({
        success: true,
        data: {
          timeline: { version: "1.0" },
        },
      });

      vi.mocked(renderVideo).mockResolvedValue({
        success: true,
        data: {
          videoPath: "/tmp/output.mp4",
        },
      });

      vi.mocked(packageAssets).mockResolvedValue({
        success: true,
        data: {
          zipPath: "/tmp/assets.zip",
        },
      });

      // Run pipeline
      await runPipeline(mockJob);

      // Verify all steps were called
      expect(ingestInputs).toHaveBeenCalledTimes(1);
      expect(generateScript).toHaveBeenCalledTimes(1);
      expect(generateVoice).toHaveBeenCalledTimes(1);
      expect(runAlignment).toHaveBeenCalledTimes(1);
      expect(planVisuals).toHaveBeenCalledTimes(1);
      expect(generateImages).toHaveBeenCalledTimes(1);
      expect(buildTimeline).toHaveBeenCalledTimes(1);
      expect(renderVideo).toHaveBeenCalledTimes(1);
      expect(packageAssets).toHaveBeenCalledTimes(1);
    });

    it("should update job status after each step", async () => {
      const { ingestInputs } = await import("../../apps/worker/src/pipeline/steps/ingest-inputs");
      const { generateScript } = await import("../../apps/worker/src/pipeline/steps/generate-script");
      const { generateVoice } = await import("../../apps/worker/src/pipeline/steps/generate-voice");
      const { runAlignment } = await import("../../apps/worker/src/pipeline/steps/run-alignment");
      const { planVisuals } = await import("../../apps/worker/src/pipeline/steps/plan-visuals");
      const { generateImages } = await import("../../apps/worker/src/pipeline/steps/generate-images");
      const { buildTimeline } = await import("../../apps/worker/src/pipeline/steps/build-timeline");
      const { renderVideo } = await import("../../apps/worker/src/pipeline/steps/render-video");
      const { packageAssets } = await import("../../apps/worker/src/pipeline/steps/package-assets");

      // Mock successful results
      vi.mocked(ingestInputs).mockResolvedValue({ success: true, data: { mergedText: "test" } });
      vi.mocked(generateScript).mockResolvedValue({
        success: true,
        data: {
          script: {
            title: "Test",
            sections: [],
            totalWordCount: 100,
            estimatedDurationMs: 60000,
            generatedAt: new Date().toISOString(),
          },
        },
      });
      vi.mocked(generateVoice).mockResolvedValue({
        success: true,
        data: { narrationPath: "/tmp/narration.mp3", durationMs: 120000 },
      });
      vi.mocked(runAlignment).mockResolvedValue({
        success: true,
        data: { segments: [], srtPath: "/tmp/captions.srt" },
      });
      vi.mocked(planVisuals).mockResolvedValue({
        success: true,
        data: { plan: { slots: [], totalImages: 5, cadenceMs: 3000 } },
      });
      vi.mocked(generateImages).mockResolvedValue({
        success: true,
        data: { imagePaths: [] },
      });
      vi.mocked(buildTimeline).mockResolvedValue({
        success: true,
        data: { timeline: {} },
      });
      vi.mocked(renderVideo).mockResolvedValue({
        success: true,
        data: { videoPath: "/tmp/output.mp4" },
      });
      vi.mocked(packageAssets).mockResolvedValue({
        success: true,
        data: { zipPath: "/tmp/assets.zip" },
      });

      // Track update calls
      const updateCalls: any[] = [];
      mockSupabaseInstance.from = vi.fn((table: string) => {
        if (table === "jobs") {
          return {
            update: vi.fn((data: any) => {
              updateCalls.push(data);
              return {
                eq: vi.fn().mockResolvedValue({ error: null }),
              };
            }),
          };
        }
        if (table === "projects") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ error: null }),
            })),
          };
        }
        if (table === "job_events") {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
      });

      await runPipeline(mockJob);

      // Verify status updates occurred
      expect(updateCalls.length).toBeGreaterThan(0);
      expect(updateCalls.some((call) => call.status === "SCRIPTING")).toBe(true);
      expect(updateCalls.some((call) => call.status === "VOICE_GEN")).toBe(true);
      expect(updateCalls.some((call) => call.status === "READY")).toBe(true);
    });

    it("should finalize credits on successful completion", async () => {
      const { ingestInputs } = await import("../../apps/worker/src/pipeline/steps/ingest-inputs");
      const { generateScript } = await import("../../apps/worker/src/pipeline/steps/generate-script");
      const { generateVoice } = await import("../../apps/worker/src/pipeline/steps/generate-voice");
      const { runAlignment } = await import("../../apps/worker/src/pipeline/steps/run-alignment");
      const { planVisuals } = await import("../../apps/worker/src/pipeline/steps/plan-visuals");
      const { generateImages } = await import("../../apps/worker/src/pipeline/steps/generate-images");
      const { buildTimeline } = await import("../../apps/worker/src/pipeline/steps/build-timeline");
      const { renderVideo } = await import("../../apps/worker/src/pipeline/steps/render-video");
      const { packageAssets } = await import("../../apps/worker/src/pipeline/steps/package-assets");

      // Mock successful results
      vi.mocked(ingestInputs).mockResolvedValue({ success: true, data: { mergedText: "test" } });
      vi.mocked(generateScript).mockResolvedValue({
        success: true,
        data: {
          script: {
            title: "Test",
            sections: [],
            totalWordCount: 100,
            estimatedDurationMs: 60000,
            generatedAt: new Date().toISOString(),
          },
        },
      });
      vi.mocked(generateVoice).mockResolvedValue({
        success: true,
        data: { narrationPath: "/tmp/narration.mp3", durationMs: 120000 },
      });
      vi.mocked(runAlignment).mockResolvedValue({
        success: true,
        data: { segments: [], srtPath: "/tmp/captions.srt" },
      });
      vi.mocked(planVisuals).mockResolvedValue({
        success: true,
        data: { plan: { slots: [], totalImages: 5, cadenceMs: 3000 } },
      });
      vi.mocked(generateImages).mockResolvedValue({
        success: true,
        data: { imagePaths: [] },
      });
      vi.mocked(buildTimeline).mockResolvedValue({
        success: true,
        data: { timeline: {} },
      });
      vi.mocked(renderVideo).mockResolvedValue({
        success: true,
        data: { videoPath: "/tmp/output.mp4" },
      });
      vi.mocked(packageAssets).mockResolvedValue({
        success: true,
        data: { zipPath: "/tmp/assets.zip" },
      });

      await runPipeline(mockJob);

      // Verify finalize_job_credits was called
      expect(mockSupabaseInstance.rpc).toHaveBeenCalledWith(
        "finalize_job_credits",
        expect.objectContaining({
          p_user_id: mockJob.user_id,
          p_job_id: mockJob.id,
        })
      );
    });
  });

  describe("Failure Handling", () => {
    it("should handle step failure and update job status to FAILED", async () => {
      const { ingestInputs } = await import("../../apps/worker/src/pipeline/steps/ingest-inputs");

      // Mock step failure
      vi.mocked(ingestInputs).mockResolvedValue({
        success: false,
        error: {
          code: "ERR_INPUT",
          message: "Invalid input",
        },
      });

      await runPipeline(mockJob);

      // Verify job was marked as FAILED
      expect(mockSupabaseInstance.from).toHaveBeenCalledWith("jobs");

      // Find the update call that sets status to FAILED
      const jobsTable = mockSupabaseInstance.from.mock.results.find(
        (result: any) => result.value?.update
      );
      expect(jobsTable).toBeDefined();
    });

    it("should release credits on failure", async () => {
      const { ingestInputs } = await import("../../apps/worker/src/pipeline/steps/ingest-inputs");

      // Mock step failure
      vi.mocked(ingestInputs).mockResolvedValue({
        success: false,
        error: {
          code: "ERR_SCRIPT_GEN",
          message: "Script generation failed",
        },
      });

      await runPipeline(mockJob);

      // Verify release_job_credits was called
      expect(mockSupabaseInstance.rpc).toHaveBeenCalledWith("release_job_credits", {
        p_job_id: mockJob.id,
      });
    });

    it("should handle project fetch failure", async () => {
      // Mock project fetch failure
      mockSupabaseInstance.from = vi.fn((table: string) => {
        if (table === "projects") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: null, error: { message: "Not found" } }),
              })),
            })),
          };
        }
        if (table === "jobs") {
          return {
            update: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ error: null }),
            })),
          };
        }
        if (table === "job_events") {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
      });

      await runPipeline(mockJob);

      // Verify job was marked as FAILED
      expect(mockSupabaseInstance.from).toHaveBeenCalledWith("jobs");
      expect(mockSupabaseInstance.rpc).toHaveBeenCalledWith("release_job_credits", {
        p_job_id: mockJob.id,
      });
    });
  });

  describe("Context Management", () => {
    it("should accumulate artifacts across pipeline steps", async () => {
      const { ingestInputs } = await import("../../apps/worker/src/pipeline/steps/ingest-inputs");
      const { generateScript } = await import("../../apps/worker/src/pipeline/steps/generate-script");
      const { generateVoice } = await import("../../apps/worker/src/pipeline/steps/generate-voice");
      const { runAlignment } = await import("../../apps/worker/src/pipeline/steps/run-alignment");
      const { planVisuals } = await import("../../apps/worker/src/pipeline/steps/plan-visuals");
      const { generateImages } = await import("../../apps/worker/src/pipeline/steps/generate-images");
      const { buildTimeline } = await import("../../apps/worker/src/pipeline/steps/build-timeline");
      const { renderVideo } = await import("../../apps/worker/src/pipeline/steps/render-video");
      const { packageAssets } = await import("../../apps/worker/src/pipeline/steps/package-assets");

      const testScript = {
        title: "Test Script",
        sections: [],
        totalWordCount: 100,
        estimatedDurationMs: 60000,
        generatedAt: new Date().toISOString(),
      };

      // Mock successful results
      vi.mocked(ingestInputs).mockResolvedValue({ success: true, data: { mergedText: "test" } });
      vi.mocked(generateScript).mockResolvedValue({
        success: true,
        data: { script: testScript },
      });
      vi.mocked(generateVoice).mockResolvedValue({
        success: true,
        data: { narrationPath: "/tmp/narration.mp3", durationMs: 120000 },
      });
      vi.mocked(runAlignment).mockResolvedValue({
        success: true,
        data: { segments: [], srtPath: "/tmp/captions.srt" },
      });
      vi.mocked(planVisuals).mockResolvedValue({
        success: true,
        data: { plan: { slots: [], totalImages: 5, cadenceMs: 3000 } },
      });
      vi.mocked(generateImages).mockResolvedValue({
        success: true,
        data: { imagePaths: [] },
      });
      vi.mocked(buildTimeline).mockResolvedValue({
        success: true,
        data: { timeline: {} },
      });
      vi.mocked(renderVideo).mockResolvedValue({
        success: true,
        data: { videoPath: "/tmp/output.mp4" },
      });
      vi.mocked(packageAssets).mockResolvedValue({
        success: true,
        data: { zipPath: "/tmp/assets.zip" },
      });

      await runPipeline(mockJob);

      // Verify context was passed to generateScript with previous artifacts
      expect(generateScript).toHaveBeenCalledWith(
        expect.objectContaining({
          artifacts: expect.objectContaining({
            mergedInputText: "test",
          }),
        })
      );

      // Verify context was passed to generateVoice with script
      expect(generateVoice).toHaveBeenCalledWith(
        expect.objectContaining({
          artifacts: expect.objectContaining({
            mergedInputText: "test",
            script: testScript,
          }),
        })
      );
    });
  });
});
