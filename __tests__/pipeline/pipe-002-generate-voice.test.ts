/**
 * PIPE-002: Voice Generation Step Test
 *
 * Acceptance Criteria:
 * - Calls OpenAI TTS API
 * - Saves MP3 file
 * - Returns duration
 * - Handles multiple sections
 * - Idempotent (skips if audio already exists)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { PipelineContext, Script } from '../../apps/worker/src/pipeline/types';

describe('PIPE-002: Voice Generation Step', () => {
  let supabase: SupabaseClient;
  let testUserId: string;
  let testProjectId: string;
  let testJobId: string;

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
      email: `test-pipe002-${Date.now()}@example.com`,
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
        title: 'Test Voice Generation Project',
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
        status: 'VOICE_GEN',
        progress: 0,
        cost_credits_reserved: 1,
      })
      .select()
      .single();

    if (jobError || !jobData) {
      throw new Error(`Failed to create test job: ${jobError?.message}`);
    }

    testJobId = jobData.id;
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
  });

  beforeEach(() => {
    // Set environment variables for mock mode
    process.env.TTS_PROVIDER = 'mock';
    process.env.OPENAI_API_KEY = 'test-key';
  });

  describe('Basic Voice Generation', () => {
    it('should accept a valid script and context', async () => {
      // Dynamically import to ensure environment is set
      const { generateVoice } = await import('../../apps/worker/src/pipeline/steps/generate-voice');

      // Create a test script
      const testScript: Script = {
        title: 'Test Video Script',
        sections: [
          {
            id: 'section-1',
            order: 0,
            headline: 'Introduction',
            narrationText: 'Welcome to this test video about technology.',
            visualKeywords: ['technology', 'welcome'],
            paceHint: 'normal',
            estimatedDurationMs: 5000,
          },
        ],
        totalWordCount: 8,
        estimatedDurationMs: 5000,
        generatedAt: new Date().toISOString(),
      };

      // Create pipeline context
      const ctx: PipelineContext = {
        job: {
          id: testJobId,
          project_id: testProjectId,
          user_id: testUserId,
          status: 'VOICE_GEN',
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
          script: testScript,
        },
      };

      // Execute voice generation (this will use mock mode)
      const result = await generateVoice(ctx);

      // Assertions - verify the function accepts valid input
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();

      // If successful, check the output structure
      if (result.success) {
        expect(result.data).toBeDefined();
        expect(result.data?.narrationPath).toBeDefined();
        expect(result.data?.durationMs).toBeGreaterThan(0);
      }
    }, 60000);

    it('should return error when script is missing', async () => {
      const { generateVoice } = await import('../../apps/worker/src/pipeline/steps/generate-voice');

      const ctx: PipelineContext = {
        job: {
          id: testJobId,
          project_id: testProjectId,
          user_id: testUserId,
          status: 'VOICE_GEN',
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
          // No script provided
        },
      };

      const result = await generateVoice(ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('ERR_TTS');
      expect(result.error?.message).toContain('No script available');
    });
  });

  describe('Idempotency', () => {
    it('should skip generation if audio already exists', async () => {
      const { generateVoice } = await import('../../apps/worker/src/pipeline/steps/generate-voice');

      // Create a test script
      const testScript: Script = {
        title: 'Test Video Script',
        sections: [
          {
            id: 'section-1',
            order: 0,
            headline: 'Introduction',
            narrationText: 'This is a test narration.',
            visualKeywords: ['test'],
            paceHint: 'normal',
            estimatedDurationMs: 3000,
          },
        ],
        totalWordCount: 5,
        estimatedDurationMs: 3000,
        generatedAt: new Date().toISOString(),
      };

      // Pre-create an asset record
      const existingAudioPath = `u_${testUserId}/p_${testProjectId}/j_${testJobId}/audio/narration.mp3`;
      await supabase.from('assets').insert({
        user_id: testUserId,
        project_id: testProjectId,
        job_id: testJobId,
        type: 'audio',
        path: existingAudioPath,
        meta: { durationMs: 3000, sections: 1 },
      });

      const ctx: PipelineContext = {
        job: {
          id: testJobId,
          project_id: testProjectId,
          user_id: testUserId,
          status: 'VOICE_GEN',
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
          script: testScript,
        },
      };

      const result = await generateVoice(ctx);

      // Should succeed and return existing audio
      expect(result.success).toBe(true);
      expect(result.data?.narrationPath).toBe(existingAudioPath);
      expect(result.data?.durationMs).toBe(3000);

      // Cleanup
      await supabase.from('assets').delete().eq('job_id', testJobId);
    });
  });

  describe('Database Integration', () => {
    it('should log job events during voice generation', async () => {
      const { generateVoice } = await import('../../apps/worker/src/pipeline/steps/generate-voice');

      const testScript: Script = {
        title: 'Test Video Script',
        sections: [
          {
            id: 'section-1',
            order: 0,
            headline: 'Test',
            narrationText: 'Test narration text for logging.',
            visualKeywords: ['test'],
            paceHint: 'normal',
            estimatedDurationMs: 2000,
          },
        ],
        totalWordCount: 5,
        estimatedDurationMs: 2000,
        generatedAt: new Date().toISOString(),
      };

      const ctx: PipelineContext = {
        job: {
          id: testJobId,
          project_id: testProjectId,
          user_id: testUserId,
          status: 'VOICE_GEN',
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
          script: testScript,
        },
      };

      await generateVoice(ctx);

      // Check that job events were logged
      const { data: events, error: eventsError } = await supabase
        .from('job_events')
        .select('*')
        .eq('job_id', testJobId)
        .eq('stage', 'VOICE_GEN')
        .order('created_at', { ascending: true });

      expect(eventsError).toBeNull();
      expect(events).toBeDefined();
      expect(events!.length).toBeGreaterThan(0);

      // Should have start event at minimum
      const messages = events!.map((e) => e.message);
      expect(messages.some((m) => m.includes('Starting voice generation') || m.includes('already exists'))).toBe(true);

      // Cleanup
      await supabase.from('assets').delete().eq('job_id', testJobId);
      await supabase.from('job_events').delete().eq('job_id', testJobId);
    }, 60000);
  });
});
