import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { createAdminSupabase } from "../../lib/supabase";
import { insertJobEvent, upsertAsset } from "../../lib/db";
import { uploadFile, downloadFile, type StorageRef } from "../../lib/storage";
import type { PipelineContext, StepResult, ProjectInput } from "../types";
import { createStepResult, createStepError } from "../types";

const supabase = createAdminSupabase();

function sha1(s: string): string {
  return crypto.createHash("sha1").update(s).digest("hex").slice(0, 10);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function tryExtractTextFromFile(localPath: string): Promise<string> {
  const ext = path.extname(localPath).toLowerCase();

  if (ext === ".txt" || ext === ".md") {
    return fs.readFile(localPath, "utf8");
  }

  if (ext === ".pdf") {
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const buf = await fs.readFile(localPath);
      const out = await pdfParse(buf);
      return out?.text ?? "";
    } catch {
      return "";
    }
  }

  if (ext === ".docx") {
    try {
      const mammoth = await import("mammoth");
      const buf = await fs.readFile(localPath);
      const out = await mammoth.extractRawText({ buffer: buf });
      return out?.value ?? "";
    } catch {
      return "";
    }
  }

  // Handle audio files (mp3, wav, m4a, webm, mp4, mpeg, mpga)
  const audioFormats = [".mp3", ".wav", ".m4a", ".webm", ".mp4", ".mpeg", ".mpga"];
  if (audioFormats.includes(ext)) {
    try {
      const { transcribeAudio } = await import("../../services/transcription");
      const result = await transcribeAudio(localPath);

      // Format transcript with timestamps for context
      let formatted = `[Audio Transcription - Duration: ${result.duration.toFixed(2)}s]\n\n`;

      if (result.segments && result.segments.length > 0) {
        formatted += result.segments.map((seg) => {
          const timestamp = `[${seg.start.toFixed(2)}s - ${seg.end.toFixed(2)}s]`;
          return `${timestamp} ${seg.text.trim()}`;
        }).join("\n");
      } else {
        formatted += result.text;
      }

      return formatted;
    } catch (error) {
      console.error(`Failed to transcribe audio file ${localPath}:`, error);
      return "";
    }
  }

  return "";
}

async function fetchUrlText(url: string): Promise<string> {
  const res = await fetch(url, { redirect: "follow" });
  const ct = res.headers.get("content-type") ?? "";
  const text = await res.text();
  const clipped = text.slice(0, 1_500_000);

  if (ct.includes("text/html")) return stripHtml(clipped);
  return clipped;
}

export async function ingestInputs(
  ctx: PipelineContext
): Promise<StepResult<{ mergedText: string }>> {
  try {
    // Fetch all project inputs
    const { data: inputs, error } = await supabase
      .from("project_inputs")
      .select("*")
      .eq("project_id", ctx.projectId)
      .order("created_at", { ascending: true });

    if (error) {
      return createStepError("ERR_INPUT_FETCH", `Failed to fetch inputs: ${error.message}`);
    }

    const textParts: string[] = [];

    // Add project context
    textParts.push(`# Project: ${ctx.project.title}`);
    textParts.push(`Niche: ${ctx.project.niche_preset}`);
    textParts.push(`Target Duration: ${ctx.project.target_minutes} minutes`);
    textParts.push("");

    // Process each input
    for (const input of (inputs as ProjectInput[]) ?? []) {
      if (input.type === "text" && input.content_text) {
        textParts.push(`## Input: ${input.title ?? "User Text"}`);
        textParts.push(input.content_text);
        textParts.push("");
      } else if (input.type === "file" && input.storage_path) {
        // Download and extract text from file
        const { data: fileData, error: fileError } = await supabase.storage
          .from("project-assets")
          .download(input.storage_path);

        if (fileError) {
          console.warn(`Failed to download file ${input.storage_path}: ${fileError.message}`);
          continue;
        }

        // Save file to temporary location for extraction
        const tempDir = `/tmp/canvascast-${ctx.jobId}`;
        await fs.mkdir(tempDir, { recursive: true });

        const filename = path.basename(input.storage_path);
        const tempPath = path.join(tempDir, filename);

        // Write blob to file
        const buffer = Buffer.from(await fileData.arrayBuffer());
        await fs.writeFile(tempPath, buffer);

        // Extract text based on file type
        const extractedText = await tryExtractTextFromFile(tempPath);

        // Clean up temp file
        await fs.unlink(tempPath).catch(() => {});

        if (extractedText) {
          textParts.push(`## Input: ${input.title ?? "Uploaded File"}`);
          textParts.push(extractedText);
          textParts.push("");
        }
      } else if (input.type === "url" && input.content_text) {
        try {
          // Import the URL scraper service
          const { scrapeUrl } = await import("../../services/url-scraper");

          // Scrape the URL
          const scraped = await scrapeUrl(input.content_text);

          // Add the scraped content
          textParts.push(`## Input: ${input.title ?? scraped.metadata.title ?? "URL Content"}`);
          textParts.push(`Source: ${input.content_text}`);
          textParts.push("");

          // Add metadata if available
          if (scraped.metadata.description) {
            textParts.push(`Description: ${scraped.metadata.description}`);
            textParts.push("");
          }

          if (scraped.metadata.author) {
            textParts.push(`Author: ${scraped.metadata.author}`);
            textParts.push("");
          }

          // Add the main content
          textParts.push(scraped.content);
          textParts.push("");

          // Add image references if any
          if (scraped.images.length > 0) {
            textParts.push(`Referenced Images (${scraped.images.length}):`);
            scraped.images.slice(0, 5).forEach((img, idx) => {
              textParts.push(`  ${idx + 1}. ${img}`);
            });
            textParts.push("");
          }
        } catch (error) {
          console.warn(`Failed to scrape URL ${input.content_text}:`, error);
          // Fallback: just use the URL as text
          textParts.push(`## Input: ${input.title ?? "URL Content"}`);
          textParts.push(`URL: ${input.content_text}`);
          textParts.push("");
        }
      }
    }

    // If no inputs found, use project title as seed
    if (textParts.length <= 4) {
      textParts.push(`## Topic`);
      textParts.push(`Create a video about: ${ctx.project.title}`);
    }

    const mergedText = textParts.join("\n");

    // Upload merged input
    const mergedPath = `${ctx.basePath}/inputs/merged_input.txt`;
    await supabase.storage
      .from("project-assets")
      .upload(mergedPath, new Blob([mergedText], { type: "text/plain" }), {
        upsert: true,
      });

    return createStepResult({ mergedText });
  } catch (error) {
    return createStepError(
      "ERR_INPUT_FETCH",
      error instanceof Error ? error.message : "Unknown error ingesting inputs"
    );
  }
}
