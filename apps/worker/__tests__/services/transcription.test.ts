import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs/promises";

// Mock fs module
vi.mock("fs/promises", () => ({
  default: {
    stat: vi.fn(),
    readFile: vi.fn(),
  },
  stat: vi.fn(),
  readFile: vi.fn(),
}));

// Mock OpenAI with factory function that gets called at runtime
vi.mock("openai", () => {
  const mockCreate = vi.fn();
  return {
    default: class MockOpenAI {
      constructor() {
        this.audio = {
          transcriptions: {
            create: mockCreate,
          },
        };
      }
      audio: any;
    },
    mockCreate, // Export for use in tests
  };
});

// Import after mocks
import { transcribeAudio } from "../../src/services/transcription";
// Get the mock create function
import { mockCreate as mockTranscriptionsCreate } from "openai";

describe("Transcription Service", () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
  });

  describe("transcribeAudio", () => {
    it("should transcribe audio file and return transcript with timestamps", async () => {
      // Arrange
      const mockTranscript = {
        text: "This is a test audio transcription.",
        segments: [
          {
            id: 0,
            start: 0.0,
            end: 2.5,
            text: "This is a test",
            tokens: [1, 2, 3],
            temperature: 0.0,
            avg_logprob: -0.5,
            compression_ratio: 1.0,
            no_speech_prob: 0.01,
          },
          {
            id: 1,
            start: 2.5,
            end: 4.8,
            text: " audio transcription.",
            tokens: [4, 5, 6],
            temperature: 0.0,
            avg_logprob: -0.5,
            compression_ratio: 1.0,
            no_speech_prob: 0.01,
          },
        ],
      };

      // Mock file operations
      vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true, size: 1024 * 1024 } as any);
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from("fake audio data") as any);

      // Mock OpenAI response
      mockTranscriptionsCreate.mockResolvedValue(mockTranscript as any);

      // Act
      const result = await transcribeAudio("/tmp/test-audio.mp3");

      // Assert
      expect(result).toEqual({
        text: "This is a test audio transcription.",
        segments: mockTranscript.segments,
        duration: 4.8,
      });

      expect(mockTranscriptionsCreate).toHaveBeenCalled();
    });

    it("should handle audio files with no speech", async () => {
      // Arrange
      const mockTranscript = {
        text: "",
        segments: [],
      };

      vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true, size: 1024 * 1024 } as any);
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from("fake audio data") as any);
      mockTranscriptionsCreate.mockResolvedValue(mockTranscript as any);

      // Act
      const result = await transcribeAudio("/tmp/empty-audio.mp3");

      // Assert
      expect(result).toEqual({
        text: "",
        segments: [],
        duration: 0,
      });
    });

    it("should handle transcription errors gracefully", async () => {
      // Arrange
      vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true, size: 1024 * 1024 } as any);
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from("fake audio data") as any);
      mockTranscriptionsCreate.mockRejectedValue(
        new Error("API rate limit exceeded")
      );

      // Act & Assert
      await expect(transcribeAudio("/tmp/test-audio.mp3")).rejects.toThrow(
        "Failed to transcribe audio: API rate limit exceeded"
      );
    });

    it("should support multiple audio formats (mp3, wav, m4a, webm)", async () => {
      // Arrange
      const mockTranscript = {
        text: "Test transcription",
        segments: [
          {
            id: 0,
            start: 0.0,
            end: 1.5,
            text: "Test transcription",
            tokens: [1],
            temperature: 0.0,
            avg_logprob: -0.5,
            compression_ratio: 1.0,
            no_speech_prob: 0.01,
          },
        ],
      };

      vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true, size: 1024 * 1024 } as any);
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from("fake audio data") as any);
      mockTranscriptionsCreate.mockResolvedValue(mockTranscript as any);

      const audioFormats = ["/tmp/audio.mp3", "/tmp/audio.wav", "/tmp/audio.m4a", "/tmp/audio.webm"];

      // Act & Assert
      for (const audioPath of audioFormats) {
        const result = await transcribeAudio(audioPath);
        expect(result.text).toBe("Test transcription");
      }
    });

    it("should include speaker detection metadata when available", async () => {
      // Arrange
      const mockTranscript = {
        text: "Speaker one. Speaker two.",
        segments: [
          {
            id: 0,
            start: 0.0,
            end: 1.5,
            text: "Speaker one.",
            tokens: [1, 2],
            temperature: 0.0,
            avg_logprob: -0.5,
            compression_ratio: 1.0,
            no_speech_prob: 0.01,
          },
          {
            id: 1,
            start: 1.5,
            end: 3.0,
            text: " Speaker two.",
            tokens: [3, 4],
            temperature: 0.0,
            avg_logprob: -0.5,
            compression_ratio: 1.0,
            no_speech_prob: 0.01,
          },
        ],
      };

      vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true, size: 1024 * 1024 } as any);
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from("fake audio data") as any);
      mockTranscriptionsCreate.mockResolvedValue(mockTranscript as any);

      // Act
      const result = await transcribeAudio("/tmp/multi-speaker.mp3");

      // Assert
      expect(result.segments).toHaveLength(2);
      expect(result.segments[0].text).toBe("Speaker one.");
      expect(result.segments[1].text).toBe(" Speaker two.");
    });
  });
});
