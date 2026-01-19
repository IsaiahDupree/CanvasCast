import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import toml from "toml";

describe("STORAGE-001: Supabase Storage Buckets Configuration", () => {
  const configPath = path.join(
    __dirname,
    "../../supabase/config.toml"
  );

  it("should have config.toml file", () => {
    expect(fs.existsSync(configPath)).toBe(true);
  });

  it("should have valid TOML configuration", () => {
    const configContent = fs.readFileSync(configPath, "utf-8");
    expect(() => toml.parse(configContent)).not.toThrow();
  });

  it("should configure generated-assets bucket", () => {
    const configContent = fs.readFileSync(configPath, "utf-8");
    const config = toml.parse(configContent);

    expect(config.storage).toBeDefined();
    expect(config.storage.buckets).toBeDefined();
    expect(config.storage.buckets["generated-assets"]).toBeDefined();

    const bucket = config.storage.buckets["generated-assets"];
    expect(bucket.public).toBe(true);
    expect(bucket.file_size_limit).toBe("500MiB");
    expect(bucket.allowed_mime_types).toContain("video/mp4");
    expect(bucket.allowed_mime_types).toContain("audio/mpeg");
    expect(bucket.allowed_mime_types).toContain("image/png");
    expect(bucket.allowed_mime_types).toContain("image/jpeg");
    expect(bucket.allowed_mime_types).toContain("text/plain");
    expect(bucket.allowed_mime_types).toContain("application/zip");
  });

  it("should configure voice-samples bucket", () => {
    const configContent = fs.readFileSync(configPath, "utf-8");
    const config = toml.parse(configContent);

    expect(config.storage.buckets["voice-samples"]).toBeDefined();

    const bucket = config.storage.buckets["voice-samples"];
    expect(bucket.public).toBe(false);
    expect(bucket.file_size_limit).toBe("50MiB");
    expect(bucket.allowed_mime_types).toContain("audio/wav");
    expect(bucket.allowed_mime_types).toContain("audio/mpeg");
    expect(bucket.allowed_mime_types).toContain("audio/x-m4a");
  });

  it("should configure temp-processing bucket", () => {
    const configContent = fs.readFileSync(configPath, "utf-8");
    const config = toml.parse(configContent);

    expect(config.storage.buckets["temp-processing"]).toBeDefined();

    const bucket = config.storage.buckets["temp-processing"];
    expect(bucket.public).toBe(false);
    expect(bucket.file_size_limit).toBe("1GiB");
  });

  it("should have storage enabled globally", () => {
    const configContent = fs.readFileSync(configPath, "utf-8");
    const config = toml.parse(configContent);

    expect(config.storage).toBeDefined();
    expect(config.storage.enabled).toBe(true);
  });
});
