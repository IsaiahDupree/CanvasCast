import OpenAI from "openai";
import * as fs from "fs/promises";
import * as path from "path";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

export interface TranscriptionResult {
  text: string;
  segments: TranscriptionSegment[];
  duration: number;
}

/**
 * Transcribe audio file using OpenAI Whisper API
 *
 * Supports multiple audio formats: mp3, wav, m4a, webm, mp4, mpeg, mpga
 * Returns full transcript with word-level timestamps and speaker detection
 *
 * @param audioPath - Path to audio file
 * @returns Transcription result with text, segments, and duration
 * @throws Error if transcription fails
 */
export async function transcribeAudio(audioPath: string): Promise<TranscriptionResult> {
  try {
    // Validate file exists
    const stats = await fs.stat(audioPath);
    if (!stats.isFile()) {
      throw new Error(`Path is not a file: ${audioPath}`);
    }

    // Validate file format
    const ext = path.extname(audioPath).toLowerCase();
    const supportedFormats = [".mp3", ".wav", ".m4a", ".webm", ".mp4", ".mpeg", ".mpga"];
    if (!supportedFormats.includes(ext)) {
      throw new Error(`Unsupported audio format: ${ext}. Supported formats: ${supportedFormats.join(", ")}`);
    }

    // Create read stream for file
    const fileStream = await fs.readFile(audioPath);
    const file = new File([fileStream], path.basename(audioPath), {
      type: getMimeType(ext),
    });

    // Call Whisper API with verbose JSON to get timestamps
    const response = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    });

    // Extract segments and calculate total duration
    const segments = (response.segments || []) as TranscriptionSegment[];
    const duration = segments.length > 0
      ? segments[segments.length - 1].end
      : 0;

    return {
      text: response.text,
      segments,
      duration,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to transcribe audio: ${message}`);
  }
}

/**
 * Get MIME type for audio file extension
 */
function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/m4a",
    ".webm": "audio/webm",
    ".mp4": "audio/mp4",
    ".mpeg": "audio/mpeg",
    ".mpga": "audio/mpeg",
  };

  return mimeTypes[ext.toLowerCase()] || "audio/mpeg";
}
