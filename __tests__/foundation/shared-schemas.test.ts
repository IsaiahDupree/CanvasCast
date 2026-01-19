import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('FOUND-003: Shared Schemas Package', () => {
  const rootDir = resolve(__dirname, '../..');
  const sharedDir = resolve(rootDir, 'packages/shared');

  it('should have timeline schema', () => {
    const schemaFile = resolve(sharedDir, 'src/timeline.schema.ts');
    expect(existsSync(schemaFile)).toBe(true);

    const content = readFileSync(schemaFile, 'utf-8');
    expect(content).toMatch(/import.*zod/);
    expect(content).toContain('TimelineContractV1');
  });

  it('should have project schema', () => {
    const schemaFile = resolve(sharedDir, 'src/schemas/project.ts');
    expect(existsSync(schemaFile)).toBe(true);

    const content = readFileSync(schemaFile, 'utf-8');
    expect(content).toMatch(/import.*zod/);
    expect(content).toContain('projectSchema');
  });

  it('should have job schema', () => {
    const schemaFile = resolve(sharedDir, 'src/schemas/job.ts');
    expect(existsSync(schemaFile)).toBe(true);

    const content = readFileSync(schemaFile, 'utf-8');
    expect(content).toMatch(/import.*zod/);
    expect(content).toContain('jobSchema');
  });

  it('should have schemas index file', () => {
    const indexFile = resolve(sharedDir, 'src/schemas/index.ts');
    expect(existsSync(indexFile)).toBe(true);

    const content = readFileSync(indexFile, 'utf-8');
    // Should export all schemas
    expect(content).toMatch(/export.*from.*project/);
    expect(content).toMatch(/export.*from.*job/);
  });
});

describe('FOUND-003: Schema Validation', () => {
  it('should validate project schema correctly', async () => {
    const { projectSchema } = await import('@canvascast/shared');

    // Valid project
    const validProject = {
      title: 'Test Video',
      niche_preset: 'explainer',
      target_minutes: 1,
    };

    expect(() => projectSchema.parse(validProject)).not.toThrow();

    // Invalid project (missing required field)
    const invalidProject = {
      niche_preset: 'explainer',
    };

    expect(() => projectSchema.parse(invalidProject)).toThrow();
  });

  it('should validate job schema correctly', async () => {
    const { jobSchema } = await import('@canvascast/shared');

    // Valid job
    const validJob = {
      project_id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174001',
      status: 'QUEUED',
    };

    expect(() => jobSchema.parse(validJob)).not.toThrow();

    // Invalid job (invalid status)
    const invalidJob = {
      project_id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174001',
      status: 'INVALID_STATUS',
    };

    expect(() => jobSchema.parse(invalidJob)).toThrow();
  });

  it('should validate timeline schema correctly', async () => {
    const { TimelineContractV1 } = await import('@canvascast/shared');

    // Valid timeline
    const validTimeline = {
      version: 1,
      fps: 30,
      width: 1920,
      height: 1080,
      segments: [
        {
          id: 'seg-1',
          startFrame: 0,
          endFrame: 90,
        },
      ],
    };

    expect(() => TimelineContractV1.parse(validTimeline)).not.toThrow();

    // Invalid timeline (no segments)
    const invalidTimeline = {
      version: 1,
      fps: 30,
      width: 1920,
      height: 1080,
      segments: [],
    };

    expect(() => TimelineContractV1.parse(invalidTimeline)).toThrow();
  });
});

describe('FOUND-003: API Schema Usage', () => {
  it('should be usable by API for request validation', async () => {
    const { projectSchema } = await import('@canvascast/shared');

    // Simulating API request validation
    const requestBody = {
      title: 'My Video',
      niche_preset: 'motivation',
      target_minutes: 2,
    };

    const result = projectSchema.safeParse(requestBody);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('My Video');
      expect(result.data.niche_preset).toBe('motivation');
    }
  });

  it('should provide detailed error messages on validation failure', async () => {
    const { projectSchema } = await import('@canvascast/shared');

    const invalidRequest = {
      title: '', // Empty title
      niche_preset: 'invalid-niche',
      target_minutes: -1, // Negative duration
    };

    const result = projectSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });
});
