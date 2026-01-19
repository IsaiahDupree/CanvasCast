import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("STORAGE-001: Storage Buckets Migration", () => {
  const migrationPath = path.join(
    __dirname,
    "../../supabase/migrations/20260119000001_storage_buckets.sql"
  );

  it("should have migration file", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it("should contain bucket creation statements", () => {
    const migration = fs.readFileSync(migrationPath, "utf-8");

    // Check for all three buckets
    expect(migration).toContain("INSERT INTO storage.buckets");
    expect(migration).toContain("generated-assets");
    expect(migration).toContain("voice-samples");
    expect(migration).toContain("temp-processing");
  });

  it("should set correct bucket properties for generated-assets", () => {
    const migration = fs.readFileSync(migrationPath, "utf-8");

    // Check bucket is public
    expect(migration).toMatch(/generated-assets.*public.*true/s);

    // Check file size limit (500MB = 524288000 bytes)
    expect(migration).toContain("524288000");

    // Check MIME types
    expect(migration).toMatch(/generated-assets.*video\/mp4/s);
    expect(migration).toMatch(/generated-assets.*audio\/mpeg/s);
    expect(migration).toMatch(/generated-assets.*image\/png/s);
  });

  it("should set correct bucket properties for voice-samples", () => {
    const migration = fs.readFileSync(migrationPath, "utf-8");

    // Check bucket is private
    expect(migration).toMatch(/voice-samples.*public.*false/s);

    // Check file size limit (50MB = 52428800 bytes)
    expect(migration).toContain("52428800");

    // Check audio MIME types
    expect(migration).toMatch(/voice-samples.*audio\/wav/s);
  });

  it("should set correct bucket properties for temp-processing", () => {
    const migration = fs.readFileSync(migrationPath, "utf-8");

    // Check bucket is private
    expect(migration).toMatch(/temp-processing.*public.*false/s);

    // Check file size limit (1GB = 1073741824 bytes)
    expect(migration).toContain("1073741824");
  });

  it("should create RLS policies for all buckets", () => {
    const migration = fs.readFileSync(migrationPath, "utf-8");

    expect(migration).toContain("CREATE POLICY");

    // Check for generated-assets policies
    expect(migration).toContain("Public read access for generated assets");
    expect(migration).toContain("Service write access for generated assets");

    // Check for voice-samples policies
    expect(migration).toContain("User read own voice samples");
    expect(migration).toContain("User upload own voice samples");

    // Check for temp-processing policies
    expect(migration).toContain("Service read access for temp processing");
    expect(migration).toContain("Service write access for temp processing");
  });

  it("should enforce service_role for generated-assets writes", () => {
    const migration = fs.readFileSync(migrationPath, "utf-8");

    expect(migration).toMatch(/Service write access.*generated-assets.*service_role/s);
  });

  it("should enforce user ownership for voice-samples", () => {
    const migration = fs.readFileSync(migrationPath, "utf-8");

    // User policies should check auth.uid()
    expect(migration).toMatch(/voice-samples.*auth\.uid\(\)/s);
  });

  it("should allow public reads for generated-assets", () => {
    const migration = fs.readFileSync(migrationPath, "utf-8");

    expect(migration).toMatch(/Public read access.*generated-assets.*FOR SELECT/s);
  });
});
