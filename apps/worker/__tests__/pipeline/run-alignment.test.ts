import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runAlignment } from "../../src/pipeline/steps/run-alignment";
import type { PipelineContext, WhisperSegment, WhisperWord } from "../../src/pipeline/types";
import OpenAI from "openai";
import Groq from "groq-sdk";
import * as fs from "fs/promises";

// Mock dependencies
vi.mock("openai");
vi.mock("groq-sdk");
vi.mock("fs/promises", () => ({
  mkdtemp: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(),
  rm: vi.fn(),
}));

vi.mock("../../src/lib/supabase", () => ({
  createAdminSupabase: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        download: vi.fn().mockResolvedValue({
          data: new Blob(["mock audio data"]),
          error: null,
        }),
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

describe("runAlignment", () => {
  let mockContext: PipelineContext;
  let mockOpenAI: any;

  beforeEach(() => {
    // Create mock context with narration path
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
        narrationPath: "test/path/audio/narration.mp3",
      },
    };

    // Mock OpenAI
    mockOpenAI = {
      audio: {
        transcriptions: {
          create: vi.fn(),
        },
      },
    };
    vi.mocked(OpenAI).mockImplementation(() => mockOpenAI as any);

    // Mock file system operations
    vi.mocked(fs.mkdtemp).mockResolvedValue("/tmp/test-whisper");
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue(Buffer.from("mock audio"));
    vi.mocked(fs.rm).mockResolvedValue(undefined);

    // Set WHISPER_MODE to openai for testing
    process.env.WHISPER_MODE = "openai";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully transcribe audio and generate segments", async () => {
    // Mock Whisper API response
    const mockTranscription = {
      segments: [
        {
          id: 0,
          start: 0.0,
          end: 3.5,
          text: " Welcome to this test video about technology.",
        },
        {
          id: 1,
          start: 3.5,
          end: 7.0,
          text: " This is a sample narration for testing.",
        },
      ],
      words: [
        { word: "Welcome", start: 0.0, end: 0.5 },
        { word: "to", start: 0.5, end: 0.6 },
        { word: "this", start: 0.6, end: 0.8 },
        { word: "test", start: 0.8, end: 1.0 },
      ],
    };

    mockOpenAI.audio.transcriptions.create.mockResolvedValue(mockTranscription);

    const result = await runAlignment(mockContext);

    expect(result.success).toBe(true);
    expect(result.data?.segments).toHaveLength(2);
    expect(result.data?.srtPath).toBeDefined();

    // Verify segments are properly formatted
    const segments = result.data!.segments;
    expect(segments[0].text).toBe("Welcome to this test video about technology.");
    expect(segments[0].start).toBe(0.0);
    expect(segments[0].end).toBe(3.5);

    // Verify OpenAI Whisper was called
    expect(mockOpenAI.audio.transcriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "whisper-1",
        response_format: "verbose_json",
        timestamp_granularities: ["segment", "word"],
      })
    );
  });

  it("should return error when no narration path is available", async () => {
    mockContext.artifacts.narrationPath = undefined;

    const result = await runAlignment(mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("ERR_ALIGNMENT");
    expect(result.error?.message).toContain("No narration audio available");
  });

  it("should skip alignment if captions already exist (idempotency)", async () => {
    // Mock existing captions asset
    const mockSupabase = await vi.importMock("../../src/lib/supabase");
    const createAdminSupabase = mockSupabase.createAdminSupabase as any;
    createAdminSupabase.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          download: vi.fn().mockResolvedValue({
            data: new Blob(["mock audio"]),
            error: null,
          }),
        })),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              path: "existing/captions.srt",
              meta: {},
            },
          }),
        })),
      })),
    });

    const result = await runAlignment(mockContext);

    expect(result.success).toBe(true);
    expect(result.data?.srtPath).toBe("existing/captions.srt");

    // Should not call Whisper if captions already exist
    expect(mockOpenAI.audio.transcriptions.create).not.toHaveBeenCalled();
  });

  it("should handle Whisper API errors", async () => {
    mockOpenAI.audio.transcriptions.create.mockRejectedValue(
      new Error("Whisper API error")
    );

    const result = await runAlignment(mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("ERR_ALIGNMENT");
    expect(result.error?.message).toContain("Whisper API error");
  });

  it("should update context artifacts with segments and words", async () => {
    const mockTranscription = {
      segments: [
        {
          id: 0,
          start: 0.0,
          end: 3.5,
          text: " Test segment",
        },
      ],
      words: [
        { word: "Test", start: 0.0, end: 0.5 },
        { word: "segment", start: 0.5, end: 1.0 },
      ],
    };

    mockOpenAI.audio.transcriptions.create.mockResolvedValue(mockTranscription);

    await runAlignment(mockContext);

    expect(mockContext.artifacts.whisperWords).toBeDefined();
    expect(mockContext.artifacts.whisperWords).toHaveLength(2);
    expect(mockContext.artifacts.whisperSegments).toBeDefined();
    expect(mockContext.artifacts.whisperSegments).toHaveLength(1);
    expect(mockContext.artifacts.captionsSrtPath).toBeDefined();
  });

  it("should handle mock mode for testing", async () => {
    process.env.WHISPER_MODE = "mock";

    const result = await runAlignment(mockContext);

    expect(result.success).toBe(true);
    expect(result.data?.segments).toBeDefined();
    expect(result.data?.segments.length).toBeGreaterThan(0);

    // Should not call OpenAI in mock mode
    expect(mockOpenAI.audio.transcriptions.create).not.toHaveBeenCalled();
  });

  it("should trim whitespace from segment text", async () => {
    const mockTranscription = {
      segments: [
        {
          id: 0,
          start: 0.0,
          end: 3.5,
          text: "  Test with leading and trailing spaces  ",
        },
      ],
      words: [],
    };

    mockOpenAI.audio.transcriptions.create.mockResolvedValue(mockTranscription);

    const result = await runAlignment(mockContext);

    expect(result.success).toBe(true);
    expect(result.data?.segments[0].text).toBe("Test with leading and trailing spaces");
  });

  it("should handle audio download errors", async () => {
    const mockSupabase = await vi.importMock("../../src/lib/supabase");
    const createAdminSupabase = mockSupabase.createAdminSupabase as any;
    createAdminSupabase.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          download: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Audio file not found" },
          }),
        })),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        })),
      })),
    });

    const result = await runAlignment(mockContext);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("ERR_ALIGNMENT");
    expect(result.error?.message).toContain("Failed to download audio");
  });
});
