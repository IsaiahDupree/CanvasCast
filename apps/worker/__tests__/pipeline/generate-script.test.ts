import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateScript } from "../../src/pipeline/steps/generate-script";
import type { PipelineContext, Script } from "../../src/pipeline/types";
import OpenAI from "openai";

// Mock dependencies
vi.mock("openai");
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
  upsertAsset: vi.fn().mockResolvedValue(undefined),
}));

describe("generateScript", () => {
  let mockContext: PipelineContext;
  let mockOpenAI: any;

  beforeEach(async () => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    // Create mock context
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
        mergedInputText: "This is a test prompt about AI technology and its impact on society.",
      },
    };

    // Mock OpenAI
    mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    };
    vi.mocked(OpenAI).mockImplementation(() => mockOpenAI as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully generate a script from merged input text", async () => {
    // Mock successful OpenAI response
    const mockScriptResponse = {
      title: "The Future of AI",
      sections: [
        {
          id: "section_001",
          order: 0,
          headline: "Introduction",
          narrationText: "Welcome to this exploration of artificial intelligence and its profound impact on modern society.",
          visualKeywords: ["AI", "technology", "future"],
          onScreenText: "The Future of AI",
          paceHint: "normal",
        },
        {
          id: "section_002",
          order: 1,
          headline: "Impact",
          narrationText: "AI is transforming industries across the globe, from healthcare to transportation.",
          visualKeywords: ["innovation", "transformation"],
          paceHint: "normal",
        },
      ],
    };

    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(mockScriptResponse),
          },
        },
      ],
    });

    const result = await generateScript(mockContext);

    // Verify success
    expect(result.success).toBe(true);
    expect(result.data?.script).toBeDefined();

    const script = result.data!.script;
    expect(script.title).toBe("The Future of AI");
    expect(script.sections).toHaveLength(2);
    expect(script.sections[0].headline).toBe("Introduction");
    expect(script.totalWordCount).toBeGreaterThan(0);
    expect(script.estimatedDurationMs).toBeGreaterThan(0);

    // Verify OpenAI was called with correct parameters
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        temperature: 0.7,
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({ role: "user" }),
        ]),
      })
    );
  });

  it("should return error when no merged input text is available", async () => {
    mockContext.artifacts.mergedInputText = "";

    const result = await generateScript(mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("ERR_SCRIPT_GEN");
    expect(result.error?.message).toContain("No merged input text");
  });

  it("should return error when OpenAI returns no content", async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: null,
          },
        },
      ],
    });

    const result = await generateScript(mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("ERR_SCRIPT_GEN");
    expect(result.error?.message).toContain("No content returned");
  });

  it("should handle OpenAI API errors gracefully", async () => {
    mockOpenAI.chat.completions.create.mockRejectedValue(
      new Error("OpenAI API rate limit exceeded")
    );

    const result = await generateScript(mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("ERR_SCRIPT_GEN");
    expect(result.error?.message).toContain("rate limit");
  });

  it("should calculate estimated duration based on word count", async () => {
    const mockScriptResponse = {
      title: "Test",
      sections: [
        {
          id: "section_001",
          order: 0,
          headline: "Test",
          narrationText: "This is a test sentence with exactly ten words here.",
          visualKeywords: [],
          paceHint: "normal",
        },
      ],
    };

    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(mockScriptResponse),
          },
        },
      ],
    });

    const result = await generateScript(mockContext);

    expect(result.success).toBe(true);
    const script = result.data!.script;
    expect(script.totalWordCount).toBe(10);
    // 10 words / 150 words per minute = 0.0667 minutes = 4000ms
    expect(script.estimatedDurationMs).toBeCloseTo(4000, -2);
  });

  it("should include niche preset in the system prompt", async () => {
    mockContext.project.niche_preset = "technology";

    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "Test",
              sections: [
                {
                  id: "section_001",
                  order: 0,
                  headline: "Test",
                  narrationText: "Test narration",
                  visualKeywords: [],
                  paceHint: "normal",
                },
              ],
            }),
          },
        },
      ],
    });

    await generateScript(mockContext);

    const systemMessage = mockOpenAI.chat.completions.create.mock.calls[0][0]
      .messages[0].content;
    expect(systemMessage).toContain("technology");
  });
});
