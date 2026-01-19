import OpenAI from "openai";
import Groq from "groq-sdk";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { createAdminSupabase } from "../../lib/supabase";
import { insertJobEvent, upsertAsset, heartbeat } from "../../lib/db";
import type { PipelineContext, StepResult, WhisperSegment, WhisperWord } from "../types";
import { createStepResult, createStepError } from "../types";

const supabase = createAdminSupabase();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, dangerouslyAllowBrowser: true });
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

const WHISPER_MODE = process.env.WHISPER_MODE ?? "openai"; // "openai" | "groq" | "mock"

export async function runAlignment(
  ctx: PipelineContext
): Promise<StepResult<{ segments: WhisperSegment[]; srtPath: string }>> {
  try {
    await insertJobEvent(ctx.jobId, "ALIGNMENT", "Starting audio alignment with Whisper...");
    await heartbeat(ctx.jobId);

    // Idempotency check: if captions already exist, skip
    const { data: existingCaptions } = await supabase
      .from("assets")
      .select("path, meta")
      .eq("job_id", ctx.jobId)
      .eq("type", "captions")
      .maybeSingle();

    if (existingCaptions?.path) {
      await insertJobEvent(ctx.jobId, "ALIGNMENT", "Captions already exist, skipping.");
      // Return empty segments - they'll be loaded from storage if needed
      return createStepResult({ segments: [], srtPath: existingCaptions.path });
    }

    const narrationPath = ctx.artifacts.narrationPath;
    if (!narrationPath) {
      await insertJobEvent(ctx.jobId, "ALIGNMENT", "No narration audio available", "error");
      return createStepError("ERR_ALIGNMENT", "No narration audio available");
    }

    // Run Whisper transcription based on mode
    let segments: WhisperSegment[];
    let words: WhisperWord[];
    let provider = WHISPER_MODE;

    if (WHISPER_MODE === "mock") {
      // Mock mode for testing - skip download
      await insertJobEvent(ctx.jobId, "ALIGNMENT", "Using mock transcription for testing...");
      const mockResult = generateMockWhisperResponse();
      segments = mockResult.segments;
      words = mockResult.words;
    } else {
      await insertJobEvent(ctx.jobId, "ALIGNMENT", "Downloading narration audio...");

      // Download narration audio
      const { data: audioData, error: downloadError } = await supabase.storage
        .from("project-assets")
        .download(narrationPath);

      if (downloadError || !audioData) {
        await insertJobEvent(ctx.jobId, "ALIGNMENT", `Failed to download audio: ${downloadError?.message}`, "error");
        return createStepError("ERR_ALIGNMENT", `Failed to download audio: ${downloadError?.message}`);
      }

      // Save to temp file
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "canvascast-whisper-"));
      const audioPath = path.join(tempDir, "narration.mp3");
      await fs.writeFile(audioPath, Buffer.from(await audioData.arrayBuffer()));

      await heartbeat(ctx.jobId);
      const audioFile = await fs.readFile(audioPath);
      const audioBlob = new File([audioFile], "narration.mp3", { type: "audio/mpeg" });

      let transcription: any;

      if (WHISPER_MODE === "groq" && groq) {
        try {
          await insertJobEvent(ctx.jobId, "ALIGNMENT", "Running Groq Whisper transcription (free)...");

          transcription = await groq.audio.transcriptions.create({
            file: audioBlob,
            model: "whisper-large-v3",
            response_format: "verbose_json",
          });

          await insertJobEvent(ctx.jobId, "ALIGNMENT", "Groq transcription successful");
        } catch (groqError) {
          await insertJobEvent(ctx.jobId, "ALIGNMENT", `Groq failed, falling back to OpenAI: ${groqError instanceof Error ? groqError.message : "Unknown error"}`, "warn");
          provider = "openai";
        }
      } else {
        provider = "openai";
        await insertJobEvent(ctx.jobId, "ALIGNMENT", "Running OpenAI Whisper transcription...");
      }

      // Fallback to OpenAI
      if (provider === "openai") {
        transcription = await openai.audio.transcriptions.create({
          file: audioBlob,
          model: "whisper-1",
          response_format: "verbose_json",
          timestamp_granularities: ["segment", "word"],
        });
      }

      await heartbeat(ctx.jobId);

      // Parse segments and words from transcription
      const rawSegments = (transcription as any).segments ?? [];
      const rawWords = (transcription as any).words ?? [];

      segments = rawSegments.map((seg: any, idx: number) => ({
        id: idx,
        start: seg.start,
        end: seg.end,
        text: seg.text.trim(),
      }));

      words = rawWords.map((w: any) => ({
        word: w.word.trim(),
        start: w.start,
        end: w.end,
      }));

      // Cleanup temp directory
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }

    await insertJobEvent(ctx.jobId, "ALIGNMENT", `Transcribed ${segments.length} segments, ${words.length} words`);

    // Generate SRT
    const srtContent = generateSRT(segments);

    // Generate VTT for web players
    const vttContent = generateVTT(segments);

    // Upload segments JSON (includes word-level data)
    const segmentsPath = `${ctx.basePath}/alignment/whisper_segments.json`;
    const segmentsData = {
      segments,
      words,
      duration: segments.length > 0 ? segments[segments.length - 1].end : 0,
    };
    await supabase.storage
      .from("project-assets")
      .upload(segmentsPath, new Blob([JSON.stringify(segmentsData, null, 2)], { type: "application/json" }), { upsert: true });

    // Upload SRT
    const srtPath = `${ctx.basePath}/alignment/captions.srt`;
    await supabase.storage
      .from("project-assets")
      .upload(srtPath, new Blob([srtContent], { type: "text/plain" }), { upsert: true });

    // Upload VTT
    const vttPath = `${ctx.basePath}/alignment/captions.vtt`;
    await supabase.storage
      .from("project-assets")
      .upload(vttPath, new Blob([vttContent], { type: "text/vtt" }), { upsert: true });

    // Create asset records
    await upsertAsset({
      user_id: ctx.userId,
      project_id: ctx.projectId,
      job_id: ctx.jobId,
      type: "caption",
      path: `project-assets/${srtPath}`,
      meta: { segmentCount: segments.length, format: "srt" },
    });

    await upsertAsset({
      user_id: ctx.userId,
      project_id: ctx.projectId,
      job_id: ctx.jobId,
      type: "whisper_segments",
      path: `project-assets/${segmentsPath}`,
      meta: { segmentCount: segments.length, wordCount: words.length },
    });

    await insertJobEvent(ctx.jobId, "ALIGNMENT", `Alignment complete: ${segments.length} segments generated`);

    // Update context artifacts
    ctx.artifacts.whisperWords = words;
    ctx.artifacts.whisperSegments = segments;
    ctx.artifacts.captionsSrtPath = srtPath;

    return createStepResult({ segments, srtPath });
  } catch (error) {
    return createStepError(
      "ERR_ALIGNMENT",
      error instanceof Error ? error.message : "Unknown error running alignment"
    );
  }
}

function generateSRT(segments: WhisperSegment[]): string {
  return segments.map((seg, idx) => {
    const start = formatSRTTime(seg.start);
    const end = formatSRTTime(seg.end);
    return `${idx + 1}\n${start} --> ${end}\n${seg.text}\n`;
  }).join("\n");
}

function generateVTT(segments: WhisperSegment[]): string {
  const header = "WEBVTT\n\n";
  const cues = segments.map((seg, idx) => {
    const start = formatVTTTime(seg.start);
    const end = formatVTTTime(seg.end);
    return `${idx + 1}\n${start} --> ${end}\n${seg.text}\n`;
  }).join("\n");
  return header + cues;
}

function formatSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function formatVTTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}

function generateMockWhisperResponse(): { segments: WhisperSegment[]; words: WhisperWord[] } {
  // Generate mock data for testing
  const mockText = "Welcome to this test video about technology. This is a sample narration for testing the alignment system.";
  const mockWords: WhisperWord[] = mockText.split(" ").map((word, index) => ({
    word,
    start: index * 0.5,
    end: (index + 1) * 0.5 - 0.05,
  }));

  const mockSegments: WhisperSegment[] = [
    {
      id: 0,
      start: 0,
      end: 3.5,
      text: "Welcome to this test video about technology.",
    },
    {
      id: 1,
      start: 3.5,
      end: 7.0,
      text: "This is a sample narration for testing the alignment system.",
    },
  ];

  return { segments: mockSegments, words: mockWords };
}
