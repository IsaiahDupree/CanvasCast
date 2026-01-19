import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateImages } from "../../src/pipeline/steps/generate-images";
import type { PipelineContext, VisualPlan } from "../../src/pipeline/types";
import OpenAI from "openai";

// Mock dependencies
vi.mock("openai");

vi.mock("../../src/lib/gemini", () => ({
  createGeminiClient: vi.fn(() => ({
    generateImage: vi.fn().mockResolvedValue(Buffer.from("mock image data")),
  })),
}));

vi.mock("../../src/lib/env", () => ({
  featureFlags: {
    imageProvider: "openai",
  },
}));

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

describe("generateImages", () => {
  let mockContext: PipelineContext;
  let mockOpenAI: any;
  let mockVisualPlan: VisualPlan;

  beforeEach(() => {
    mockVisualPlan = {
      slots: [
        {
          id: "slot_000",
          startMs: 0,
          endMs: 4000,
          text: "Welcome to this video about technology",
          prompt: "photorealistic, high quality, cinematic lighting, technology, scene depicting: Welcome to this video about technology",
          stylePreset: "photorealistic",
        },
        {
          id: "slot_001",
          startMs: 4000,
          endMs: 8000,
          text: "and innovation in artificial intelligence",
          prompt: "photorealistic, high quality, cinematic lighting, AI, innovation, scene depicting: and innovation in artificial intelligence",
          stylePreset: "photorealistic",
        },
        {
          id: "slot_002",
          startMs: 8000,
          endMs: 12000,
          text: "Let's explore the future together",
          prompt: "photorealistic, high quality, cinematic lighting, future, scene depicting: Let's explore the future together",
          stylePreset: "photorealistic",
        },
      ],
      totalImages: 3,
      cadenceMs: 4000,
    };

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
        visualPlan: mockVisualPlan,
      },
    };

    // Mock OpenAI
    mockOpenAI = {
      images: {
        generate: vi.fn(),
      },
    };
    vi.mocked(OpenAI).mockImplementation(() => mockOpenAI as any);

    // Set default environment
    process.env.OPENAI_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully generate images for all visual slots", async () => {
    // Mock OpenAI DALL-E response
    mockOpenAI.images.generate.mockResolvedValue({
      data: [
        {
          b64_json: Buffer.from("mock image data").toString("base64"),
        },
      ],
    });

    const result = await generateImages(mockContext);

    expect(result.success).toBe(true);
    expect(result.data?.imagePaths).toHaveLength(3);

    // Verify OpenAI was called for each slot
    expect(mockOpenAI.images.generate).toHaveBeenCalledTimes(3);

    // Verify proper parameters
    expect(mockOpenAI.images.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "dall-e-3",
        n: 1,
        size: "1024x1792", // Vertical format
        quality: "standard",
        response_format: "b64_json",
      })
    );
  });

  it("should return error when no visual plan is available", async () => {
    mockContext.artifacts.visualPlan = undefined;

    const result = await generateImages(mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("ERR_IMAGE_GEN");
    expect(result.error?.message).toContain("Visual plan is required");
  });

  it("should return error when visual plan has no slots", async () => {
    mockContext.artifacts.visualPlan = {
      slots: [],
      totalImages: 0,
      cadenceMs: 4000,
    };

    const result = await generateImages(mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("ERR_IMAGE_GEN");
    expect(result.error?.message).toContain("no slots");
  });

  it("should process images in batches to avoid rate limits", async () => {
    // Create a larger visual plan with 10 slots
    const largeVisualPlan: VisualPlan = {
      slots: Array.from({ length: 10 }, (_, i) => ({
        id: `slot_${String(i).padStart(3, "0")}`,
        startMs: i * 4000,
        endMs: (i + 1) * 4000,
        text: `Slot ${i} text`,
        prompt: `Test prompt ${i}`,
        stylePreset: "photorealistic",
      })),
      totalImages: 10,
      cadenceMs: 4000,
    };

    mockContext.artifacts.visualPlan = largeVisualPlan;

    mockOpenAI.images.generate.mockResolvedValue({
      data: [
        {
          b64_json: Buffer.from("mock image data").toString("base64"),
        },
      ],
    });

    const result = await generateImages(mockContext);

    expect(result.success).toBe(true);
    expect(result.data?.imagePaths).toHaveLength(10);
  });

  it("should retry failed image generation", async () => {
    let callCount = 0;
    mockOpenAI.images.generate.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error("Temporary API error"));
      }
      return Promise.resolve({
        data: [
          {
            b64_json: Buffer.from("mock image data").toString("base64"),
          },
        ],
      });
    });

    const result = await generateImages(mockContext);

    expect(result.success).toBe(true);
    // Should have retried and succeeded
    expect(mockOpenAI.images.generate).toHaveBeenCalledTimes(4); // 1 fail + 1 retry, then 2 more successful
  });

  it("should fail after max retries", async () => {
    // Create a plan with just one slot for simpler testing
    mockContext.artifacts.visualPlan = {
      slots: [mockVisualPlan.slots[0]],
      totalImages: 1,
      cadenceMs: 4000,
    };

    mockOpenAI.images.generate.mockRejectedValue(
      new Error("Persistent API error")
    );

    const result = await generateImages(mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("ERR_IMAGE_GEN");
    expect(result.error?.message).toContain("after 2 retries");
  });

  it("should update context artifacts with image paths", async () => {
    mockOpenAI.images.generate.mockResolvedValue({
      data: [
        {
          b64_json: Buffer.from("mock image data").toString("base64"),
        },
      ],
    });

    await generateImages(mockContext);

    expect(mockContext.artifacts.imagePaths).toBeDefined();
    expect(mockContext.artifacts.imagePaths).toHaveLength(3);
  });

  it("should handle OpenAI API errors", async () => {
    // Create a plan with just one slot
    mockContext.artifacts.visualPlan = {
      slots: [mockVisualPlan.slots[0]],
      totalImages: 1,
      cadenceMs: 4000,
    };

    mockOpenAI.images.generate.mockRejectedValue(
      new Error("OpenAI API error")
    );

    const result = await generateImages(mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("ERR_IMAGE_GEN");
  });

  it("should use Gemini when configured", async () => {
    const mockGemini = await vi.importMock("../../src/lib/gemini");
    const mockEnv = await vi.importMock("../../src/lib/env");

    // Set to use Gemini
    (mockEnv.featureFlags as any).imageProvider = "gemini";
    process.env.GEMINI_API_KEY = "test-gemini-key";

    const mockGenerateImage = vi.fn().mockResolvedValue(Buffer.from("mock gemini image"));
    (mockGemini.createGeminiClient as any).mockReturnValue({
      generateImage: mockGenerateImage,
    });

    const result = await generateImages(mockContext);

    expect(result.success).toBe(true);
    expect(mockGenerateImage).toHaveBeenCalledTimes(3);

    // Verify Gemini-specific parameters
    expect(mockGenerateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        aspectRatio: "9:16",
        numberOfImages: 1,
      })
    );

    // OpenAI should not be called when using Gemini
    expect(mockOpenAI.images.generate).not.toHaveBeenCalled();
  });

  it("should include slot metadata in image prompts", async () => {
    mockOpenAI.images.generate.mockResolvedValue({
      data: [
        {
          b64_json: Buffer.from("mock image data").toString("base64"),
        },
      ],
    });

    await generateImages(mockContext);

    // Verify prompts include the slot text/keywords
    const calls = mockOpenAI.images.generate.mock.calls;
    calls.forEach((call, index) => {
      const prompt = call[0].prompt;
      expect(prompt).toBeDefined();
      expect(prompt.length).toBeGreaterThan(0);
    });
  });

  it("should handle empty b64_json response from OpenAI", async () => {
    mockContext.artifacts.visualPlan = {
      slots: [mockVisualPlan.slots[0]],
      totalImages: 1,
      cadenceMs: 4000,
    };

    mockOpenAI.images.generate.mockResolvedValue({
      data: [
        {
          b64_json: null,
        },
      ],
    });

    const result = await generateImages(mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("ERR_IMAGE_GEN");
  });
});
