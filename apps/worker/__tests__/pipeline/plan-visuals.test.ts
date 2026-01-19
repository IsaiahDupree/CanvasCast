import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { planVisuals } from "../../src/pipeline/steps/plan-visuals";
import type { PipelineContext, Script, WhisperSegment } from "../../src/pipeline/types";

// Mock dependencies
vi.mock("../../src/lib/supabase", () => ({
  createAdminSupabase: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  })),
}));

vi.mock("../../src/lib/db", () => ({
  insertJobEvent: vi.fn().mockResolvedValue(undefined),
}));

describe("planVisuals", () => {
  let mockContext: PipelineContext;
  let mockScript: Script;
  let mockSegments: WhisperSegment[];

  beforeEach(() => {
    mockScript = {
      title: "Test Video",
      sections: [
        {
          id: "section_001",
          order: 0,
          headline: "Introduction",
          narrationText: "Welcome to this video about technology and innovation.",
          visualKeywords: ["technology", "innovation", "future"],
          paceHint: "normal",
          estimatedDurationMs: 5000,
        },
        {
          id: "section_002",
          order: 1,
          headline: "Main Content",
          narrationText: "Let's explore the fascinating world of artificial intelligence.",
          visualKeywords: ["AI", "machine learning", "automation"],
          paceHint: "normal",
          estimatedDurationMs: 6000,
        },
      ],
      totalWordCount: 20,
      estimatedDurationMs: 11000,
      generatedAt: new Date().toISOString(),
    };

    mockSegments = [
      {
        id: 0,
        start: 0.0,
        end: 2.5,
        text: "Welcome to this video",
      },
      {
        id: 1,
        start: 2.5,
        end: 5.0,
        text: "about technology and innovation.",
      },
      {
        id: 2,
        start: 5.0,
        end: 8.0,
        text: "Let's explore the fascinating world",
      },
      {
        id: 3,
        start: 8.0,
        end: 11.0,
        text: "of artificial intelligence.",
      },
    ];

    mockContext = {
      jobId: "test-job-id",
      projectId: "test-project-id",
      userId: "test-user-id",
      basePath: "test/path",
      outputPath: "test/output",
      job: {
        id: "test-job-id",
        project_id: "test-project-id",
        user_id: "test-user-id",
        status: "processing",
        progress: 0,
        error_code: null,
        error_message: null,
        claimed_at: null,
        claimed_by: null,
        started_at: new Date().toISOString(),
        finished_at: null,
        cost_credits_reserved: 1,
        cost_credits_final: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      project: {
        id: "test-project-id",
        user_id: "test-user-id",
        title: "Test Video",
        niche_preset: "educational",
        target_minutes: 1,
        status: "draft",
        template_id: "default",
        visual_preset_id: "photorealistic",
        voice_profile_id: null,
        image_density: "normal",
        target_resolution: "1080p",
        timeline_path: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      artifacts: {
        script: mockScript,
        whisperSegments: mockSegments,
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully create visual plan with slots", async () => {
    const result = await planVisuals(mockContext);

    expect(result.success).toBe(true);
    expect(result.data?.plan).toBeDefined();

    const plan = result.data!.plan;
    expect(plan.slots).toBeDefined();
    expect(plan.slots.length).toBeGreaterThan(0);
    expect(plan.totalImages).toBe(plan.slots.length);
    expect(plan.cadenceMs).toBeDefined();
  });

  it("should return error when no script is available", async () => {
    mockContext.artifacts.script = undefined;

    const result = await planVisuals(mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("ERR_VISUAL_PLAN");
    expect(result.error?.message).toContain("Script artifact is required");
  });

  it("should return error when no whisper segments are available", async () => {
    mockContext.artifacts.whisperSegments = undefined;

    const result = await planVisuals(mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("ERR_VISUAL_PLAN");
    expect(result.error?.message).toContain("Whisper segments are required");
  });

  it("should return error when whisper segments array is empty", async () => {
    mockContext.artifacts.whisperSegments = [];

    const result = await planVisuals(mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("ERR_VISUAL_PLAN");
    expect(result.error?.message).toContain("Whisper segments are required");
  });

  it("should respect image density setting - low", async () => {
    mockContext.project.image_density = "low";

    const result = await planVisuals(mockContext);

    expect(result.success).toBe(true);
    expect(result.data?.plan.cadenceMs).toBe(10000); // 10 seconds for low density
  });

  it("should respect image density setting - normal", async () => {
    mockContext.project.image_density = "normal";

    const result = await planVisuals(mockContext);

    expect(result.success).toBe(true);
    expect(result.data?.plan.cadenceMs).toBe(7000); // 7 seconds for normal density
  });

  it("should respect image density setting - high", async () => {
    mockContext.project.image_density = "high";

    const result = await planVisuals(mockContext);

    expect(result.success).toBe(true);
    expect(result.data?.plan.cadenceMs).toBe(4000); // 4 seconds for high density
  });

  it("should create slots with proper time ranges", async () => {
    const result = await planVisuals(mockContext);

    expect(result.success).toBe(true);
    const slots = result.data!.plan.slots;

    // Verify slots don't overlap and cover the full duration
    for (let i = 0; i < slots.length - 1; i++) {
      expect(slots[i].endMs).toBeLessThanOrEqual(slots[i + 1].startMs);
    }

    // First slot should start at 0
    expect(slots[0].startMs).toBe(0);

    // Last slot should end at or near the last segment end time
    const lastSlot = slots[slots.length - 1];
    const lastSegment = mockSegments[mockSegments.length - 1];
    expect(lastSlot.endMs).toBeCloseTo(lastSegment.end * 1000, -1);
  });

  it("should include image prompts for each slot", async () => {
    const result = await planVisuals(mockContext);

    expect(result.success).toBe(true);
    const slots = result.data!.plan.slots;

    slots.forEach((slot) => {
      expect(slot.prompt).toBeDefined();
      expect(slot.prompt.length).toBeGreaterThan(0);
      expect(slot.id).toMatch(/^slot_\d{3}$/);
    });
  });

  it("should incorporate visual keywords from script sections into prompts", async () => {
    const result = await planVisuals(mockContext);

    expect(result.success).toBe(true);
    const slots = result.data!.plan.slots;

    // At least one slot should contain keywords from the script
    const hasKeywords = slots.some(
      (slot) =>
        slot.prompt.includes("technology") ||
        slot.prompt.includes("innovation") ||
        slot.prompt.includes("AI")
    );

    expect(hasKeywords).toBe(true);
  });

  it("should use visual preset in prompts", async () => {
    mockContext.project.visual_preset_id = "cinematic";

    const result = await planVisuals(mockContext);

    expect(result.success).toBe(true);
    const slots = result.data!.plan.slots;

    // Check that prompts include style-specific keywords
    const hasCinematicStyle = slots.some((slot) =>
      slot.prompt.toLowerCase().includes("cinematic")
    );

    expect(hasCinematicStyle).toBe(true);
  });

  it("should update context artifacts with visual plan", async () => {
    await planVisuals(mockContext);

    expect(mockContext.artifacts.visualPlan).toBeDefined();
    expect(mockContext.artifacts.visualPlan?.slots).toBeDefined();
  });

  it("should handle different visual presets correctly", async () => {
    const presets = ["photorealistic", "illustration", "minimalist", "anime"];

    for (const preset of presets) {
      mockContext.project.visual_preset_id = preset;

      const result = await planVisuals(mockContext);

      expect(result.success).toBe(true);
      const slots = result.data!.plan.slots;

      slots.forEach((slot) => {
        expect(slot.stylePreset).toBe(preset);
      });
    }
  });

  it("should group segments into slots based on cadence", async () => {
    // Set high density for more frequent image changes
    mockContext.project.image_density = "high"; // 4 seconds

    const result = await planVisuals(mockContext);

    expect(result.success).toBe(true);
    const plan = result.data!.plan;

    // With 11 seconds of content and 4 second cadence, expect at least 2 slots
    expect(plan.slots.length).toBeGreaterThanOrEqual(2);
  });
});
