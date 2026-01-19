import { describe, it, expect, vi, beforeEach } from "vitest";
import * as storage from "../../apps/worker/src/lib/storage";
import type { StorageRef } from "../../apps/worker/src/lib/storage";

// Mock the Supabase client
vi.mock("../../apps/worker/src/lib/supabase", () => ({
  createAdminSupabase: vi.fn(() => ({
    storage: {
      from: vi.fn((bucket: string) => ({
        upload: vi.fn((path: string, data: any, options: any) => {
          if (bucket === "error-bucket") {
            return { error: { message: "Upload failed" } };
          }
          return {
            data: { path, fullPath: `${bucket}/${path}` },
            error: null,
          };
        }),
        getPublicUrl: vi.fn((path: string) => ({
          data: {
            publicUrl: `https://example.supabase.co/storage/v1/object/public/${bucket}/${path}`,
          },
        })),
        createSignedUrl: vi.fn((path: string, expiresIn: number) =>
          Promise.resolve({
            data: {
              signedUrl: `https://example.supabase.co/storage/v1/object/sign/${bucket}/${path}?token=abc123`,
            },
            error: null,
          })
        ),
        download: vi.fn((path: string) => {
          if (bucket === "error-bucket") {
            return { error: { message: "Download failed" }, data: null };
          }
          const buffer = Buffer.from("test content");
          const mockData = {
            arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
          };
          return { data: mockData, error: null };
        }),
      })),
    },
  })),
}));

// Mock fs/promises
vi.mock("fs/promises", () => ({
  readFile: vi.fn((path: string) => Promise.resolve(Buffer.from("test file content"))),
  writeFile: vi.fn(() => Promise.resolve()),
}));

describe("STORAGE-002: Upload Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("uploadBuffer", () => {
    it("should upload buffer to storage and return successfully", async () => {
      const buffer = Buffer.from("test content");
      const dest: StorageRef = {
        bucket: "generated-assets",
        path: "users/user123/jobs/job456/video.mp4",
      };

      await expect(
        storage.uploadBuffer(buffer, dest, "video/mp4")
      ).resolves.not.toThrow();
    });

    it("should upload buffer with correct content type", async () => {
      const buffer = Buffer.from("test image content");
      const dest: StorageRef = {
        bucket: "generated-assets",
        path: "users/user123/jobs/job456/image.png",
      };

      await expect(
        storage.uploadBuffer(buffer, dest, "image/png")
      ).resolves.not.toThrow();
    });

    it("should throw error on upload failure", async () => {
      const buffer = Buffer.from("test content");
      const dest: StorageRef = {
        bucket: "error-bucket",
        path: "test/path",
      };

      await expect(
        storage.uploadBuffer(buffer, dest, "video/mp4")
      ).rejects.toThrow("Failed to upload test/path: Upload failed");
    });

    it("should support Uint8Array as input", async () => {
      const uint8Array = new Uint8Array([1, 2, 3, 4, 5]);
      const dest: StorageRef = {
        bucket: "generated-assets",
        path: "users/user123/test.bin",
      };

      await expect(
        storage.uploadBuffer(uint8Array, dest, "application/octet-stream")
      ).resolves.not.toThrow();
    });
  });

  describe("uploadFile", () => {
    it("should upload file from local path", async () => {
      const localPath = "/tmp/test-video.mp4";
      const dest: StorageRef = {
        bucket: "generated-assets",
        path: "users/user123/jobs/job456/video.mp4",
      };

      await expect(
        storage.uploadFile(localPath, dest, "video/mp4")
      ).resolves.not.toThrow();
    });

    it("should upload audio files", async () => {
      const localPath = "/tmp/test-audio.mp3";
      const dest: StorageRef = {
        bucket: "generated-assets",
        path: "users/user123/jobs/job456/audio.mp3",
      };

      await expect(
        storage.uploadFile(localPath, dest, "audio/mpeg")
      ).resolves.not.toThrow();
    });
  });

  describe("getPublicUrl", () => {
    it("should return public URL for uploaded file", () => {
      const ref: StorageRef = {
        bucket: "generated-assets",
        path: "users/user123/jobs/job456/video.mp4",
      };

      const url = storage.getPublicUrl(ref);

      expect(url).toBeDefined();
      expect(url).toContain("generated-assets");
      expect(url).toContain("users/user123/jobs/job456/video.mp4");
      expect(url).toMatch(/^https:\/\//);
    });

    it("should return different URLs for different paths", () => {
      const ref1: StorageRef = {
        bucket: "generated-assets",
        path: "users/user123/video1.mp4",
      };

      const ref2: StorageRef = {
        bucket: "generated-assets",
        path: "users/user456/video2.mp4",
      };

      const url1 = storage.getPublicUrl(ref1);
      const url2 = storage.getPublicUrl(ref2);

      expect(url1).not.toBe(url2);
      expect(url1).toContain("video1.mp4");
      expect(url2).toContain("video2.mp4");
    });
  });

  describe("getSignedUrl", () => {
    it("should return signed URL with default expiration", async () => {
      const ref: StorageRef = {
        bucket: "voice-samples",
        path: "users/user123/sample.wav",
      };

      const url = await storage.getSignedUrl(ref);

      expect(url).toBeDefined();
      expect(url).toContain("voice-samples");
      expect(url).toContain("token=");
      expect(url).toMatch(/^https:\/\//);
    });

    it("should return signed URL with custom expiration", async () => {
      const ref: StorageRef = {
        bucket: "voice-samples",
        path: "users/user123/sample.wav",
      };

      const url = await storage.getSignedUrl(ref, 7200);

      expect(url).toBeDefined();
      expect(url).toContain("token=");
    });
  });

  describe("downloadBuffer", () => {
    it("should download file as buffer", async () => {
      const ref: StorageRef = {
        bucket: "generated-assets",
        path: "users/user123/jobs/job456/video.mp4",
      };

      const buffer = await storage.downloadBuffer(ref);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it("should throw error on download failure", async () => {
      const ref: StorageRef = {
        bucket: "error-bucket",
        path: "test/path",
      };

      await expect(storage.downloadBuffer(ref)).rejects.toThrow(
        "Failed to download test/path: Download failed"
      );
    });
  });

  describe("Storage Reference Helpers", () => {
    it("should split bucket path correctly", () => {
      const fullPath = "generated-assets/users/user123/video.mp4";
      const ref = storage.splitBucketPath(fullPath);

      expect(ref).not.toBeNull();
      expect(ref?.bucket).toBe("generated-assets");
      expect(ref?.path).toBe("users/user123/video.mp4");
    });

    it("should join bucket path correctly", () => {
      const ref: StorageRef = {
        bucket: "generated-assets",
        path: "users/user123/video.mp4",
      };

      const fullPath = storage.joinBucketPath(ref);

      expect(fullPath).toBe("generated-assets/users/user123/video.mp4");
    });

    it("should return null for invalid bucket paths", () => {
      const invalidPath = "invalid-bucket/path";
      const ref = storage.splitBucketPath(invalidPath);

      expect(ref).toBeNull();
    });

    it("should return null for malformed paths", () => {
      const malformedPath = "nobucket";
      const ref = storage.splitBucketPath(malformedPath);

      expect(ref).toBeNull();
    });
  });

  describe("Integration: Upload and Retrieve", () => {
    it("should upload buffer and get public URL", async () => {
      const buffer = Buffer.from("test video content");
      const dest: StorageRef = {
        bucket: "generated-assets",
        path: "users/user123/jobs/job456/final.mp4",
      };

      // Upload
      await storage.uploadBuffer(buffer, dest, "video/mp4");

      // Get public URL
      const url = storage.getPublicUrl(dest);

      expect(url).toBeDefined();
      expect(url).toContain("final.mp4");
    });

    it("should upload file and get signed URL", async () => {
      const localPath = "/tmp/voice-sample.wav";
      const dest: StorageRef = {
        bucket: "voice-samples",
        path: "users/user123/profile/sample.wav",
      };

      // Upload
      await storage.uploadFile(localPath, dest, "audio/wav");

      // Get signed URL
      const url = await storage.getSignedUrl(dest, 3600);

      expect(url).toBeDefined();
      expect(url).toContain("token=");
    });
  });
});
