import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ingestInputs } from "../../src/pipeline/steps/ingest-inputs";
import type { PipelineContext } from "../../src/pipeline/types";
import * as fs from "fs/promises";
import * as path from "path";

// Create a simple in-memory file system for tests
const mockFileSystem: Record<string, Buffer> = {};

// Mock fs/promises
vi.mock("fs/promises", () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn((path: string, data: Buffer) => {
      mockFileSystem[path] = data;
      return Promise.resolve();
    }),
    readFile: vi.fn((path: string) => {
      const data = mockFileSystem[path];
      return Promise.resolve(data || Buffer.from(""));
    }),
    unlink: vi.fn((path: string) => {
      delete mockFileSystem[path];
      return Promise.resolve();
    }),
  },
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn((path: string, data: Buffer) => {
    mockFileSystem[path] = data;
    return Promise.resolve();
  }),
  readFile: vi.fn((path: string) => {
    const data = mockFileSystem[path];
    return Promise.resolve(data || Buffer.from(""));
  }),
  unlink: vi.fn((path: string) => {
    delete mockFileSystem[path];
    return Promise.resolve();
  }),
}));

// Mock pdf-parse
let mockPdfParseResult = { text: "", numpages: 1 };
vi.mock("pdf-parse", () => ({
  default: vi.fn(() => Promise.resolve(mockPdfParseResult)),
}));

// Mock mammoth
let mockMammothResult = { value: "" };
vi.mock("mammoth", () => ({
  extractRawText: vi.fn(() => Promise.resolve(mockMammothResult)),
}));

// Mock dependencies
vi.mock("../../src/lib/supabase", () => ({
  createAdminSupabase: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        })),
      })),
    })),
    storage: {
      from: vi.fn(() => ({
        download: vi.fn(),
        upload: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  })),
}));

vi.mock("../../src/lib/db", () => ({
  insertJobEvent: vi.fn().mockResolvedValue(undefined),
  upsertAsset: vi.fn().mockResolvedValue(undefined),
}));

describe("ingestInputs - PDF Extraction", () => {
  let mockContext: PipelineContext;
  let mockSupabase: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Clear mock file system
    Object.keys(mockFileSystem).forEach(key => delete mockFileSystem[key]);

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
      artifacts: {},
    };

    // Get the mocked supabase instance
    const { createAdminSupabase } = await import("../../src/lib/supabase");
    mockSupabase = createAdminSupabase();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should extract text from PDF files", async () => {
    const mockPdfText = "This is text extracted from a PDF document. It contains important information.";

    // Set mock result for pdf-parse
    mockPdfParseResult = {
      text: mockPdfText,
      numpages: 1,
    };

    // Mock project_inputs with a PDF file
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "input-1",
                project_id: mockContext.projectId,
                type: "file",
                title: "Document.pdf",
                content_text: null,
                storage_path: "uploads/test-user/document.pdf",
                meta: {},
                created_at: new Date().toISOString(),
              },
            ],
            error: null,
          }),
        })),
      })),
    });

    // Mock storage download to return a PDF buffer
    const mockPdfBuffer = Buffer.from("mock pdf content");
    mockSupabase.storage.from().download.mockResolvedValue({
      data: new Blob([mockPdfBuffer], { type: "application/pdf" }),
      error: null,
    });

    const result = await ingestInputs(mockContext);

    // Verify success
    expect(result.success).toBe(true);
    expect(result.data?.mergedText).toBeDefined();

    // Verify PDF text is included in merged text
    const mergedText = result.data!.mergedText;

    // Debug: log the merged text
    console.log("MergedText:", mergedText);
    console.log("Expected to contain:", mockPdfText);

    expect(mergedText).toContain("Document.pdf");
    expect(mergedText).toContain(mockPdfText);

    // Verify storage download was called
    expect(mockSupabase.storage.from).toHaveBeenCalledWith("project-assets");
    expect(mockSupabase.storage.from().download).toHaveBeenCalledWith(
      "uploads/test-user/document.pdf"
    );
  });

  it("should handle PDF extraction errors gracefully", async () => {
    // Import pdf-parse mock to make it throw
    const pdfParse = await import("pdf-parse");
    vi.mocked(pdfParse.default).mockRejectedValueOnce(new Error("Invalid PDF structure"));

    // Mock project_inputs with a PDF file
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "input-1",
                project_id: mockContext.projectId,
                type: "file",
                title: "Corrupted.pdf",
                content_text: null,
                storage_path: "uploads/test-user/corrupted.pdf",
                meta: {},
                created_at: new Date().toISOString(),
              },
            ],
            error: null,
          }),
        })),
      })),
    });

    // Mock storage download to return a corrupted PDF buffer
    mockSupabase.storage.from().download.mockResolvedValue({
      data: new Blob([Buffer.from("not a real pdf")], { type: "application/pdf" }),
      error: null,
    });

    const result = await ingestInputs(mockContext);

    // Should still succeed but without PDF content
    expect(result.success).toBe(true);
    expect(result.data?.mergedText).toBeDefined();

    // Should contain project metadata but not PDF content
    const mergedText = result.data!.mergedText;
    expect(mergedText).toContain("Test Video");
    expect(mergedText).toContain("educational");
  });

  it("should preserve formatting from PDF extraction", async () => {
    const mockPdfText = `Title: Important Document

    Section 1: Introduction
    This is the introduction text.

    Section 2: Details
    Here are the details.`;

    // Set mock result for pdf-parse
    mockPdfParseResult = {
      text: mockPdfText,
      numpages: 1,
    };

    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "input-1",
                project_id: mockContext.projectId,
                type: "file",
                title: "Report.pdf",
                content_text: null,
                storage_path: "uploads/test-user/report.pdf",
                meta: {},
                created_at: new Date().toISOString(),
              },
            ],
            error: null,
          }),
        })),
      })),
    });

    mockSupabase.storage.from().download.mockResolvedValue({
      data: new Blob([Buffer.from("mock pdf content")], { type: "application/pdf" }),
      error: null,
    });

    const result = await ingestInputs(mockContext);

    expect(result.success).toBe(true);
    const mergedText = result.data!.mergedText;

    // Verify formatting is preserved
    expect(mergedText).toContain("Title: Important Document");
    expect(mergedText).toContain("Section 1: Introduction");
    expect(mergedText).toContain("Section 2: Details");
  });

  it("should handle multiple file types including PDF", async () => {
    // Set mock result for pdf-parse
    mockPdfParseResult = {
      text: "PDF extracted text content.",
      numpages: 1,
    };

    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "input-1",
                project_id: mockContext.projectId,
                type: "text",
                title: "Plain text input",
                content_text: "This is plain text content.",
                storage_path: null,
                meta: {},
                created_at: new Date().toISOString(),
              },
              {
                id: "input-2",
                project_id: mockContext.projectId,
                type: "file",
                title: "Document.pdf",
                content_text: null,
                storage_path: "uploads/test-user/document.pdf",
                meta: {},
                created_at: new Date().toISOString(),
              },
            ],
            error: null,
          }),
        })),
      })),
    });

    mockSupabase.storage.from().download.mockResolvedValue({
      data: new Blob([Buffer.from("mock pdf content")], { type: "application/pdf" }),
      error: null,
    });

    const result = await ingestInputs(mockContext);

    expect(result.success).toBe(true);
    const mergedText = result.data!.mergedText;

    // Should contain both text and PDF content
    expect(mergedText).toContain("This is plain text content");
    expect(mergedText).toContain("PDF extracted text content");
  });

  it("should skip PDF extraction if download fails", async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "input-1",
                project_id: mockContext.projectId,
                type: "file",
                title: "Missing.pdf",
                content_text: null,
                storage_path: "uploads/test-user/missing.pdf",
                meta: {},
                created_at: new Date().toISOString(),
              },
            ],
            error: null,
          }),
        })),
      })),
    });

    // Mock storage download failure
    mockSupabase.storage.from().download.mockResolvedValue({
      data: null,
      error: { message: "File not found" },
    });

    const result = await ingestInputs(mockContext);

    // Should succeed without the PDF content
    expect(result.success).toBe(true);
    expect(result.data?.mergedText).toBeDefined();
  });

  it("should scrape and extract content from URL inputs", async () => {
    const mockUrl = "https://example.com/blog/test-article";
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test Blog Article</title>
          <meta name="description" content="A great article about testing">
          <meta property="og:image" content="https://example.com/cover.jpg">
        </head>
        <body>
          <article>
            <h1>Test Blog Article</h1>
            <p>This is the main content of the article with useful information.</p>
            <img src="/images/photo.jpg" alt="Photo">
          </article>
        </body>
      </html>
    `;

    // Mock project inputs with URL type
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "input-1",
                project_id: mockContext.projectId,
                type: "url",
                title: "Blog Article",
                content_text: mockUrl,
                storage_path: null,
                meta: {},
                created_at: new Date().toISOString(),
              },
            ],
            error: null,
          }),
        })),
      })),
    });

    // Mock fetch for URL scraping
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      text: async () => mockHtml,
    } as Response);

    const result = await ingestInputs(mockContext);

    expect(result.success).toBe(true);
    const mergedText = result.data!.mergedText;

    // Should contain URL content
    expect(mergedText).toContain("Blog Article");
    expect(mergedText).toContain("Source: https://example.com/blog/test-article");
    expect(mergedText).toContain("main content of the article");
    expect(mergedText).toContain("Referenced Images");
  });

  it("should handle URL scraping errors gracefully", async () => {
    const mockUrl = "https://invalid-site.com/article";

    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "input-1",
                project_id: mockContext.projectId,
                type: "url",
                title: "Failed URL",
                content_text: mockUrl,
                storage_path: null,
                meta: {},
                created_at: new Date().toISOString(),
              },
            ],
            error: null,
          }),
        })),
      })),
    });

    // Mock fetch failure
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const result = await ingestInputs(mockContext);

    // Should succeed with fallback
    expect(result.success).toBe(true);
    const mergedText = result.data!.mergedText;

    // Should contain fallback URL reference
    expect(mergedText).toContain("Failed URL");
    expect(mergedText).toContain("URL: https://invalid-site.com/article");
  });
});
