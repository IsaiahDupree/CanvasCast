import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateVoice } from "../../src/pipeline/steps/generate-voice";
import type { PipelineContext, Script } from "../../src/pipeline/types";
import OpenAI from "openai";
import * as fs from "fs/promises";

// Mock dependencies
vi.mock("openai");
vi.mock("child_process", () => {
  const spawn = vi.fn(() => ({
    on: vi.fn((event, callback) => {
      if (event === "close") {
        setTimeout(() => callback(0), 10);
      }
    }),
  }));
  return { spawn };
});

vi.mock("fs/promises", () => ({
  mkdtemp: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  rm: vi.fn(),
  copyFile: vi.fn(),
  unlink: vi.fn(),
}));

vi.mock("../../src/lib/supabase", () => ({
  createAdminSupabase: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      })),
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  })),
}));

vi.mock("../../src/lib/db", () => ({
  insertJobEvent: vi.fn().mockResolvedValue(undefined),
  upsertAsset: vi.fn().mockResolvedValue(undefined),
  heartbeat: vi.fn().mockResolvedValue(undefined),
}));

describe("generateVoice", () => {
  let mockContext: PipelineContext;
  let mockOpenAI: any;

  beforeEach(() => {
    // Create mock context with script
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
        script: {
          title: "Test Script",
          sections: [
            {
              id: "section_001",
              order: 0,
              headline: "Introduction",
              narrationText: "This is the first section with about ten words total.",
              visualKeywords: ["test"],
              paceHint: "normal",
              estimatedDurationMs: 4000,
            },
            {
              id: "section_002",
              order: 1,
              headline: "Conclusion",
              narrationText: "This is the second section with roughly ten words here.",
              visualKeywords: ["test"],
              paceHint: "normal",
              estimatedDurationMs: 4000,
            },
          ],
          totalWordCount: 20,
          estimatedDurationMs: 8000,
          generatedAt: new Date().toISOString(),
        },
      },
    };

    // Mock OpenAI
    mockOpenAI = {
      audio: {
        speech: {
          create: vi.fn(),
        },
      },
    };
    vi.mocked(OpenAI).mockImplementation(() => mockOpenAI as any);

    // Mock file system operations
    vi.mocked(fs.mkdtemp).mockResolvedValue("/tmp/test-dir");
    vi.mocked(fs.readFile).mockResolvedValue(Buffer.from("fake audio data"));
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.rm).mockResolvedValue(undefined);

    // Set TTS_PROVIDER to openai for testing
    process.env.TTS_PROVIDER = "openai";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully generate voice for all script sections", async () => {
    // Mock OpenAI TTS response
    const mockAudioBuffer = Buffer.from("mock audio data");
    mockOpenAI.audio.speech.create.mockResolvedValue({
      arrayBuffer: async () => mockAudioBuffer.buffer,
    });

    const result = await generateVoice(mockContext);

    expect(result.success).toBe(true);
    expect(result.data?.narrationPath).toBeDefined();
    expect(result.data?.durationMs).toBeGreaterThan(0);

    // Verify OpenAI TTS was called for each section
    expect(mockOpenAI.audio.speech.create).toHaveBeenCalledTimes(2);

    // Verify it was called with correct parameters
    expect(mockOpenAI.audio.speech.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "tts-1",
        voice: expect.any(String),
        input: expect.stringContaining("first section"),
        response_format: "mp3",
      })
    );
  });

  it("should return error when no script is available", async () => {
    mockContext.artifacts.script = undefined;

    const result = await generateVoice(mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("ERR_TTS");
    expect(result.error?.message).toContain("No script available");
  });

  it("should skip generation if narration already exists (idempotency)", async () => {
    // Mock existing audio asset
    const mockSupabase = await vi.importMock("../../src/lib/supabase");
    const createAdminSupabase = mockSupabase.createAdminSupabase as any;
    createAdminSupabase.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn().mockResolvedValue({ error: null }),
        })),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              path: "existing/narration.mp3",
              meta: { durationMs: 10000 },
            },
          }),
        })),
      })),
    });

    const result = await generateVoice(mockContext);

    expect(result.success).toBe(true);
    expect(result.data?.narrationPath).toBe("existing/narration.mp3");
    expect(result.data?.durationMs).toBe(10000);

    // Should not call OpenAI if audio already exists
    expect(mockOpenAI.audio.speech.create).not.toHaveBeenCalled();
  });

  it("should handle OpenAI TTS API errors", async () => {
    mockOpenAI.audio.speech.create.mockRejectedValue(
      new Error("OpenAI TTS API error")
    );

    const result = await generateVoice(mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("ERR_TTS");
    expect(result.error?.message).toContain("TTS API error");
  });

  it("should calculate total duration from all sections", async () => {
    const mockAudioBuffer = Buffer.from("mock audio data");
    mockOpenAI.audio.speech.create.mockResolvedValue({
      arrayBuffer: async () => mockAudioBuffer.buffer,
    });

    // Each section has ~10 words, which should be ~4000ms at 150 WPM
    const result = await generateVoice(mockContext);

    expect(result.success).toBe(true);
    // Total should be approximately 8000ms (2 sections * 4000ms)
    expect(result.data?.durationMs).toBeGreaterThan(7000);
    expect(result.data?.durationMs).toBeLessThan(9000);
  });

  it("should update context artifacts with section audio paths", async () => {
    const mockAudioBuffer = Buffer.from("mock audio data");
    mockOpenAI.audio.speech.create.mockResolvedValue({
      arrayBuffer: async () => mockAudioBuffer.buffer,
    });

    await generateVoice(mockContext);

    expect(mockContext.artifacts.sectionAudioPaths).toBeDefined();
    expect(mockContext.artifacts.sectionAudioPaths).toHaveLength(2);
  });

  it("should use correct voice from environment variable", async () => {
    process.env.OPENAI_TTS_VOICE = "nova";

    const mockAudioBuffer = Buffer.from("mock audio data");
    mockOpenAI.audio.speech.create.mockResolvedValue({
      arrayBuffer: async () => mockAudioBuffer.buffer,
    });

    await generateVoice(mockContext);

    expect(mockOpenAI.audio.speech.create).toHaveBeenCalledWith(
      expect.objectContaining({
        voice: "nova",
      })
    );
  });
});
