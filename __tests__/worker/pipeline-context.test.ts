/**
 * Tests for Pipeline Context Creation and Artifact Management
 * Feature: WORKER-003 - Pipeline Context
 */

import { describe, it, expect } from 'vitest';
import { createPipelineContext, addArtifact, getArtifact } from '../../apps/worker/src/pipeline/context';
import type { JobRow, ProjectRow, PipelineContext } from '../../apps/worker/src/pipeline/types';

describe('Pipeline Context', () => {
  const mockJob: JobRow = {
    id: 'job_123',
    project_id: 'proj_456',
    user_id: 'user_789',
    status: 'QUEUED',
    progress: 0,
    error_code: null,
    error_message: null,
    claimed_at: null,
    claimed_by: null,
    started_at: null,
    finished_at: null,
    cost_credits_reserved: 5,
    cost_credits_final: 0,
    created_at: '2026-01-19T00:00:00Z',
    updated_at: '2026-01-19T00:00:00Z',
  };

  const mockProject: ProjectRow = {
    id: 'proj_456',
    user_id: 'user_789',
    title: 'Test Video',
    niche_preset: 'explainer',
    target_minutes: 1,
    status: 'processing',
    template_id: 'tpl_default',
    visual_preset_id: 'vp_default',
    voice_profile_id: null,
    image_density: 'medium',
    target_resolution: '1080p',
    timeline_path: null,
    created_at: '2026-01-19T00:00:00Z',
    updated_at: '2026-01-19T00:00:00Z',
  };

  describe('createPipelineContext', () => {
    it('should create a context with correct IDs', () => {
      const ctx = createPipelineContext(mockJob, mockProject);

      expect(ctx.jobId).toBe('job_123');
      expect(ctx.projectId).toBe('proj_456');
      expect(ctx.userId).toBe('user_789');
    });

    it('should include job and project data', () => {
      const ctx = createPipelineContext(mockJob, mockProject);

      expect(ctx.job).toBe(mockJob);
      expect(ctx.project).toBe(mockProject);
    });

    it('should generate correct basePath', () => {
      const ctx = createPipelineContext(mockJob, mockProject);

      expect(ctx.basePath).toBe('project-assets/u_user_789/p_proj_456/j_job_123');
    });

    it('should generate correct outputPath', () => {
      const ctx = createPipelineContext(mockJob, mockProject);

      expect(ctx.outputPath).toBe('project-outputs/u_user_789/p_proj_456/j_job_123');
    });

    it('should initialize empty artifacts', () => {
      const ctx = createPipelineContext(mockJob, mockProject);

      expect(ctx.artifacts).toEqual({});
    });
  });

  describe('Artifact Management', () => {
    let ctx: PipelineContext;

    beforeEach(() => {
      ctx = createPipelineContext(mockJob, mockProject);
    });

    it('should add artifacts to context', () => {
      addArtifact(ctx, 'mergedInputText', 'This is the input text');

      expect(ctx.artifacts.mergedInputText).toBe('This is the input text');
    });

    it('should retrieve artifacts from context', () => {
      ctx.artifacts.mergedInputText = 'Test content';

      const result = getArtifact(ctx, 'mergedInputText');

      expect(result).toBe('Test content');
    });

    it('should return undefined for missing artifacts', () => {
      const result = getArtifact(ctx, 'nonExistentArtifact' as any);

      expect(result).toBeUndefined();
    });

    it('should accumulate multiple artifacts', () => {
      addArtifact(ctx, 'mergedInputText', 'Input text');
      addArtifact(ctx, 'narrationPath', '/path/to/audio.mp3');
      addArtifact(ctx, 'narrationDurationMs', 60000);

      expect(ctx.artifacts.mergedInputText).toBe('Input text');
      expect(ctx.artifacts.narrationPath).toBe('/path/to/audio.mp3');
      expect(ctx.artifacts.narrationDurationMs).toBe(60000);
    });

    it('should allow overwriting artifacts', () => {
      addArtifact(ctx, 'mergedInputText', 'Original text');
      addArtifact(ctx, 'mergedInputText', 'Updated text');

      expect(ctx.artifacts.mergedInputText).toBe('Updated text');
    });

    it('should handle complex artifact objects', () => {
      const script = {
        title: 'Test Script',
        sections: [
          {
            id: 'sec_1',
            order: 1,
            headline: 'Introduction',
            narrationText: 'Welcome to the video',
            visualKeywords: ['intro', 'welcome'],
            paceHint: 'normal' as const,
            estimatedDurationMs: 5000,
          },
        ],
        totalWordCount: 4,
        estimatedDurationMs: 5000,
        generatedAt: '2026-01-19T00:00:00Z',
      };

      addArtifact(ctx, 'script', script);

      expect(ctx.artifacts.script).toEqual(script);
      expect(ctx.artifacts.script?.sections.length).toBe(1);
    });

    it('should handle array artifacts', () => {
      const imagePaths = ['/path/to/img1.png', '/path/to/img2.png'];

      addArtifact(ctx, 'imagePaths', imagePaths);

      expect(ctx.artifacts.imagePaths).toEqual(imagePaths);
      expect(ctx.artifacts.imagePaths?.length).toBe(2);
    });
  });

  describe('Context Immutability', () => {
    it('should allow artifacts to be modified during pipeline', () => {
      const ctx = createPipelineContext(mockJob, mockProject);

      // Step 1: Add merged input
      ctx.artifacts.mergedInputText = 'Input text';

      // Step 2: Add script
      ctx.artifacts.script = {
        title: 'Test',
        sections: [],
        totalWordCount: 0,
        estimatedDurationMs: 0,
        generatedAt: new Date().toISOString(),
      };

      // Step 3: Add narration
      ctx.artifacts.narrationPath = '/audio.mp3';
      ctx.artifacts.narrationDurationMs = 30000;

      // Verify all artifacts are retained
      expect(ctx.artifacts.mergedInputText).toBe('Input text');
      expect(ctx.artifacts.script).toBeDefined();
      expect(ctx.artifacts.narrationPath).toBe('/audio.mp3');
      expect(ctx.artifacts.narrationDurationMs).toBe(30000);
    });
  });
});
