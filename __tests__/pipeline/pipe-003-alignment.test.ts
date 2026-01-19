/**
 * PIPE-003: Alignment Step Test
 *
 * Acceptance Criteria:
 * - Calls Whisper API
 * - Returns word segments
 * - Generates SRT/VTT
 * - Handles audio preprocessing
 * - Validates alignment quality
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { PipelineContext } from '../../apps/worker/src/pipeline/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('PIPE-003: Alignment Step', () => {
  let supabase: SupabaseClient;
  let testUserId: string;
  let testProjectId: string;
  let testJobId: string;
  let tempDir: string;

  beforeAll(async () => {
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Create test user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: `test-pipe003-${Date.now()}@example.com`,
      password: 'test-password-123',
      email_confirm: true,
    });

    if (authError || !authData.user) {
      throw new Error(`Failed to create test user: ${authError?.message}`);
    }

    testUserId = authData.user.id;

    // Create test project
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .insert({
        user_id: testUserId,
        title: 'Test Alignment Project',
        niche_preset: 'explainer',
        target_minutes: 1,
      })
      .select()
      .single();

    if (projectError || !projectData) {
      throw new Error(`Failed to create test project: ${projectError?.message}`);
    }

    testProjectId = projectData.id;

    // Create test job
    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .insert({
        project_id: testProjectId,
        user_id: testUserId,
        status: 'ALIGNMENT',
        progress: 0,
        cost_credits_reserved: 1,
      })
      .select()
      .single();

    if (jobError || !jobData) {
      throw new Error(`Failed to create test job: ${jobError?.message}`);
    }

    testJobId = jobData.id;

    // Create temp directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'canvascast-alignment-test-'));
  });

  afterAll(async () => {
    // Cleanup test data
    if (testJobId) {
      await supabase.from('assets').delete().eq('job_id', testJobId);
      await supabase.from('job_events').delete().eq('job_id', testJobId);
      await supabase.from('jobs').delete().eq('id', testJobId);
    }
    if (testProjectId) {
      await supabase.from('projects').delete().eq('id', testProjectId);
    }
    if (testUserId) {
      await supabase.auth.admin.deleteUser(testUserId);
    }

    // Cleanup temp directory
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  beforeEach(() => {
    // Set environment variables
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.WHISPER_MODE = 'mock'; // Use mock mode for tests
  });

  describe('Basic Alignment', () => {
    it('should accept valid audio path and context', async () => {
      // Dynamically import to ensure environment is set
      const { runAlignment } = await import('../../apps/worker/src/pipeline/steps/run-alignment');

      // Create a mock audio file path
      const narrationPath = `u_${testUserId}/p_${testProjectId}/j_${testJobId}/audio/narration.mp3`;

      // Create pipeline context with narration artifact
      const ctx: PipelineContext = {
        job: {
          id: testJobId,
          project_id: testProjectId,
          user_id: testUserId,
          status: 'ALIGNMENT',
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
          id: testProjectId,
          user_id: testUserId,
          title: 'Test Project',
          niche_preset: 'explainer',
          target_minutes: 1,
          status: 'draft',
          template_id: 'standard_portrait',
          visual_preset_id: 'modern',
          voice_profile_id: null,
          image_density: 'medium',
          target_resolution: '1080x1920',
          timeline_path: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        userId: testUserId,
        projectId: testProjectId,
        jobId: testJobId,
        basePath: `u_${testUserId}/p_${testProjectId}/j_${testJobId}`,
        outputPath: `u_${testUserId}/p_${testProjectId}/j_${testJobId}`,
        artifacts: {
          narrationPath,
          narrationDurationMs: 5000,
        },
      };

      // Execute alignment
      const result = await runAlignment(ctx);

      // Assertions - verify the function accepts valid input
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();

      // If successful, check the output structure
      if (result.success) {
        expect(result.data).toBeDefined();
        expect(result.data?.segments).toBeDefined();
        expect(Array.isArray(result.data?.segments)).toBe(true);
        expect(result.data?.srtPath).toBeDefined();
      }
    }, 60000);

    it('should return error when narration path is missing', async () => {
      const { runAlignment } = await import('../../apps/worker/src/pipeline/steps/run-alignment');

      const ctx: PipelineContext = {
        job: {
          id: testJobId,
          project_id: testProjectId,
          user_id: testUserId,
          status: 'ALIGNMENT',
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
          id: testProjectId,
          user_id: testUserId,
          title: 'Test Project',
          niche_preset: 'explainer',
          target_minutes: 1,
          status: 'draft',
          template_id: 'standard_portrait',
          visual_preset_id: 'modern',
          voice_profile_id: null,
          image_density: 'medium',
          target_resolution: '1080x1920',
          timeline_path: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        userId: testUserId,
        projectId: testProjectId,
        jobId: testJobId,
        basePath: `u_${testUserId}/p_${testProjectId}/j_${testJobId}`,
        outputPath: `u_${testUserId}/p_${testProjectId}/j_${testJobId}`,
        artifacts: {
          // No narration path provided
        },
      };

      const result = await runAlignment(ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('ERR_ALIGNMENT');
      expect(result.error?.message).toContain('No narration audio available');
    });
  });

  describe('Word Segments', () => {
    it('should return word-level segments with timestamps', async () => {
      const { runAlignment } = await import('../../apps/worker/src/pipeline/steps/run-alignment');

      const narrationPath = `u_${testUserId}/p_${testProjectId}/j_${testJobId}/audio/narration.mp3`;

      const ctx: PipelineContext = {
        job: {
          id: testJobId,
          project_id: testProjectId,
          user_id: testUserId,
          status: 'ALIGNMENT',
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
          id: testProjectId,
          user_id: testUserId,
          title: 'Test Project',
          niche_preset: 'explainer',
          target_minutes: 1,
          status: 'draft',
          template_id: 'standard_portrait',
          visual_preset_id: 'modern',
          voice_profile_id: null,
          image_density: 'medium',
          target_resolution: '1080x1920',
          timeline_path: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        userId: testUserId,
        projectId: testProjectId,
        jobId: testJobId,
        basePath: `u_${testUserId}/p_${testProjectId}/j_${testJobId}`,
        outputPath: `u_${testUserId}/p_${testProjectId}/j_${testJobId}`,
        artifacts: {
          narrationPath,
          narrationDurationMs: 5000,
        },
      };

      const result = await runAlignment(ctx);

      expect(result.success).toBe(true);
      expect(result.data?.segments).toBeDefined();

      // Check segment structure
      const segments = result.data!.segments;
      expect(segments.length).toBeGreaterThan(0);

      // Each segment should have required properties
      segments.forEach((segment) => {
        expect(segment).toHaveProperty('id');
        expect(segment).toHaveProperty('start');
        expect(segment).toHaveProperty('end');
        expect(segment).toHaveProperty('text');
        expect(typeof segment.start).toBe('number');
        expect(typeof segment.end).toBe('number');
        expect(segment.end).toBeGreaterThan(segment.start);
      });
    }, 60000);

    it('should populate whisperWords in context artifacts', async () => {
      const { runAlignment } = await import('../../apps/worker/src/pipeline/steps/run-alignment');

      const narrationPath = `u_${testUserId}/p_${testProjectId}/j_${testJobId}/audio/narration.mp3`;

      const ctx: PipelineContext = {
        job: {
          id: testJobId,
          project_id: testProjectId,
          user_id: testUserId,
          status: 'ALIGNMENT',
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
          id: testProjectId,
          user_id: testUserId,
          title: 'Test Project',
          niche_preset: 'explainer',
          target_minutes: 1,
          status: 'draft',
          template_id: 'standard_portrait',
          visual_preset_id: 'modern',
          voice_profile_id: null,
          image_density: 'medium',
          target_resolution: '1080x1920',
          timeline_path: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        userId: testUserId,
        projectId: testProjectId,
        jobId: testJobId,
        basePath: `u_${testUserId}/p_${testProjectId}/j_${testJobId}`,
        outputPath: `u_${testUserId}/p_${testProjectId}/j_${testJobId}`,
        artifacts: {
          narrationPath,
          narrationDurationMs: 5000,
        },
      };

      await runAlignment(ctx);

      // Check that whisperWords is populated in artifacts
      expect(ctx.artifacts.whisperWords).toBeDefined();
      expect(Array.isArray(ctx.artifacts.whisperWords)).toBe(true);
      expect(ctx.artifacts.whisperWords!.length).toBeGreaterThan(0);

      // Check word structure
      const words = ctx.artifacts.whisperWords!;
      words.forEach((word) => {
        expect(word).toHaveProperty('word');
        expect(word).toHaveProperty('start');
        expect(word).toHaveProperty('end');
        expect(typeof word.word).toBe('string');
        expect(typeof word.start).toBe('number');
        expect(typeof word.end).toBe('number');
      });
    }, 60000);
  });

  describe('Caption Generation', () => {
    it('should generate SRT file', async () => {
      const { runAlignment } = await import('../../apps/worker/src/pipeline/steps/run-alignment');

      const narrationPath = `u_${testUserId}/p_${testProjectId}/j_${testJobId}/audio/narration.mp3`;

      const ctx: PipelineContext = {
        job: {
          id: testJobId,
          project_id: testProjectId,
          user_id: testUserId,
          status: 'ALIGNMENT',
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
          id: testProjectId,
          user_id: testUserId,
          title: 'Test Project',
          niche_preset: 'explainer',
          target_minutes: 1,
          status: 'draft',
          template_id: 'standard_portrait',
          visual_preset_id: 'modern',
          voice_profile_id: null,
          image_density: 'medium',
          target_resolution: '1080x1920',
          timeline_path: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        userId: testUserId,
        projectId: testProjectId,
        jobId: testJobId,
        basePath: `u_${testUserId}/p_${testProjectId}/j_${testJobId}`,
        outputPath: `u_${testUserId}/p_${testProjectId}/j_${testJobId}`,
        artifacts: {
          narrationPath,
          narrationDurationMs: 5000,
        },
      };

      const result = await runAlignment(ctx);

      expect(result.success).toBe(true);
      expect(result.data?.srtPath).toBeDefined();
      expect(typeof result.data?.srtPath).toBe('string');
      expect(result.data?.srtPath).toMatch(/\.srt$/);
    }, 60000);

    it('should populate captionsSrtPath in context artifacts', async () => {
      const { runAlignment } = await import('../../apps/worker/src/pipeline/steps/run-alignment');

      const narrationPath = `u_${testUserId}/p_${testProjectId}/j_${testJobId}/audio/narration.mp3`;

      const ctx: PipelineContext = {
        job: {
          id: testJobId,
          project_id: testProjectId,
          user_id: testUserId,
          status: 'ALIGNMENT',
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
          id: testProjectId,
          user_id: testUserId,
          title: 'Test Project',
          niche_preset: 'explainer',
          target_minutes: 1,
          status: 'draft',
          template_id: 'standard_portrait',
          visual_preset_id: 'modern',
          voice_profile_id: null,
          image_density: 'medium',
          target_resolution: '1080x1920',
          timeline_path: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        userId: testUserId,
        projectId: testProjectId,
        jobId: testJobId,
        basePath: `u_${testUserId}/p_${testProjectId}/j_${testJobId}`,
        outputPath: `u_${testUserId}/p_${testProjectId}/j_${testJobId}`,
        artifacts: {
          narrationPath,
          narrationDurationMs: 5000,
        },
      };

      await runAlignment(ctx);

      expect(ctx.artifacts.captionsSrtPath).toBeDefined();
      expect(typeof ctx.artifacts.captionsSrtPath).toBe('string');
    }, 60000);
  });

  describe('Database Integration', () => {
    it('should log job events during alignment', async () => {
      const { runAlignment } = await import('../../apps/worker/src/pipeline/steps/run-alignment');

      const narrationPath = `u_${testUserId}/p_${testProjectId}/j_${testJobId}/audio/narration.mp3`;

      const ctx: PipelineContext = {
        job: {
          id: testJobId,
          project_id: testProjectId,
          user_id: testUserId,
          status: 'ALIGNMENT',
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
          id: testProjectId,
          user_id: testUserId,
          title: 'Test Project',
          niche_preset: 'explainer',
          target_minutes: 1,
          status: 'draft',
          template_id: 'standard_portrait',
          visual_preset_id: 'modern',
          voice_profile_id: null,
          image_density: 'medium',
          target_resolution: '1080x1920',
          timeline_path: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        userId: testUserId,
        projectId: testProjectId,
        jobId: testJobId,
        basePath: `u_${testUserId}/p_${testProjectId}/j_${testJobId}`,
        outputPath: `u_${testUserId}/p_${testProjectId}/j_${testJobId}`,
        artifacts: {
          narrationPath,
          narrationDurationMs: 5000,
        },
      };

      await runAlignment(ctx);

      // Check that job events were logged
      const { data: events, error: eventsError } = await supabase
        .from('job_events')
        .select('*')
        .eq('job_id', testJobId)
        .eq('stage', 'ALIGNMENT')
        .order('created_at', { ascending: true });

      expect(eventsError).toBeNull();
      expect(events).toBeDefined();
      expect(events!.length).toBeGreaterThan(0);

      // Should have start event at minimum
      const messages = events!.map((e) => e.message);
      expect(messages.some((m) => m.includes('Starting alignment') || m.includes('alignment'))).toBe(true);

      // Cleanup
      await supabase.from('assets').delete().eq('job_id', testJobId);
      await supabase.from('job_events').delete().eq('job_id', testJobId);
    }, 60000);
  });
});
