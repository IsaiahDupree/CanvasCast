/**
 * PIPE-004: Visual Plan Step Test
 *
 * Acceptance Criteria:
 * - Maps scenes to timestamps
 * - Generates image prompts
 * - Determines image density based on project settings
 * - Creates visual slots with timing information
 * - Calculates total images and cadence
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { planVisuals } from '../../apps/worker/src/pipeline/steps/plan-visuals';
import type { PipelineContext, Script, WhisperSegment, WhisperWord } from '../../apps/worker/src/pipeline/types';

describe('PIPE-004: Visual Plan Step', () => {
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
      email: `test-pipe004-${Date.now()}@example.com`,
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
        title: 'Test Visual Plan Project',
        niche_preset: 'explainer',
        target_minutes: 1,
        image_density: 'normal', // 1 image every 6-8 seconds
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
        status: 'VISUAL_PLAN',
        progress: 40,
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

  it('should generate visual plan with correct structure', async () => {
    // Create mock pipeline context
    const mockScript: Script = {
      title: 'Test Video',
      sections: [
        {
          id: 'section_001',
          order: 0,
          headline: 'Introduction',
          narrationText: 'Welcome to our test video about technology and innovation.',
          visualKeywords: ['technology', 'innovation', 'digital'],
          onScreenText: 'Welcome',
          paceHint: 'normal',
          estimatedDurationMs: 5000,
        },
        {
          id: 'section_002',
          order: 1,
          headline: 'Main Content',
          narrationText: 'Today we will explore the fascinating world of artificial intelligence.',
          visualKeywords: ['AI', 'machine learning', 'neural networks'],
          onScreenText: 'AI Explained',
          paceHint: 'normal',
          estimatedDurationMs: 6000,
        },
        {
          id: 'section_003',
          order: 2,
          headline: 'Conclusion',
          narrationText: 'Thanks for watching, and remember to subscribe for more content.',
          visualKeywords: ['subscribe', 'community', 'learning'],
          paceHint: 'normal',
          estimatedDurationMs: 4000,
        },
      ],
      totalWordCount: 150,
      estimatedDurationMs: 15000,
      generatedAt: new Date().toISOString(),
    };

    const mockWhisperSegments: WhisperSegment[] = [
      { id: 0, start: 0, end: 5, text: 'Welcome to our test video about technology and innovation.' },
      { id: 1, start: 5, end: 11, text: 'Today we will explore the fascinating world of artificial intelligence.' },
      { id: 2, start: 11, end: 15, text: 'Thanks for watching, and remember to subscribe for more content.' },
    ];

    const mockWhisperWords: WhisperWord[] = [
      { word: 'Welcome', start: 0, end: 0.5 },
      { word: 'to', start: 0.5, end: 0.7 },
      { word: 'our', start: 0.7, end: 0.9 },
      // ... (abbreviated for test)
    ];

    const mockProject = {
      id: testProjectId,
      user_id: testUserId,
      title: 'Test Visual Plan Project',
      niche_preset: 'explainer',
      target_minutes: 1,
      status: 'processing',
      template_id: 'default',
      visual_preset_id: 'default',
      voice_profile_id: null,
      image_density: 'normal',
      target_resolution: '1080x1920',
      timeline_path: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockJob = {
      id: testJobId,
      project_id: testProjectId,
      user_id: testUserId,
      status: 'VISUAL_PLAN' as const,
      progress: 40,
      error_code: null,
      error_message: null,
      claimed_at: new Date().toISOString(),
      claimed_by: 'test-worker',
      started_at: new Date().toISOString(),
      finished_at: null,
      cost_credits_reserved: 1,
      cost_credits_final: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const ctx: PipelineContext = {
      job: mockJob,
      project: mockProject,
      jobId: testJobId,
      projectId: testProjectId,
      userId: testUserId,
      basePath: `project-assets/u_${testUserId}/p_${testProjectId}/j_${testJobId}`,
      outputPath: `project-outputs/u_${testUserId}/p_${testProjectId}/j_${testJobId}`,
      artifacts: {
        script: mockScript,
        whisperSegments: mockWhisperSegments,
        whisperWords: mockWhisperWords,
        narrationDurationMs: 15000,
      },
    };

    // Execute the plan-visuals step
    const result = await planVisuals(ctx);

    // Debug output
    if (!result.success) {
      console.error('Visual plan failed:', result.error);
    }

    // Assertions
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.plan).toBeDefined();

    const plan = result.data!.plan;

    // Check that visual plan has correct structure
    expect(plan.slots).toBeDefined();
    expect(Array.isArray(plan.slots)).toBe(true);
    expect(plan.slots.length).toBeGreaterThan(0);
    expect(plan.totalImages).toBeGreaterThan(0);
    expect(plan.cadenceMs).toBeGreaterThan(0);

    // Check that each slot has required properties
    for (const slot of plan.slots) {
      expect(slot.id).toBeDefined();
      expect(typeof slot.startMs).toBe('number');
      expect(typeof slot.endMs).toBe('number');
      expect(slot.endMs).toBeGreaterThan(slot.startMs);
      expect(slot.text).toBeDefined();
      expect(slot.prompt).toBeDefined();
      expect(slot.stylePreset).toBeDefined();
    }

    // Check that cadence matches image density setting
    // Normal density should be around 6-8 seconds per image (6000-8000ms)
    expect(plan.cadenceMs).toBeGreaterThanOrEqual(5000);
    expect(plan.cadenceMs).toBeLessThanOrEqual(9000);

    // Verify asset was created in database
    const { data: assetData, error: assetError } = await supabase
      .from('assets')
      .select('*')
      .eq('job_id', testJobId)
      .eq('type', 'other')
      .maybeSingle();

    if (assetError) {
      console.error('Asset query error:', assetError);
    }

    expect(assetData).toBeDefined();
    expect(assetData).not.toBeNull();
    if (assetData) {
      expect(assetData.storage_path).toBeDefined();
      expect(assetData.storage_path).toContain('visual_plan.json');
    }
  });

  it('should handle different image density settings', async () => {
    // Test with high density (more images)
    const highDensityProject = {
      id: testProjectId,
      user_id: testUserId,
      title: 'High Density Test',
      niche_preset: 'explainer',
      target_minutes: 1,
      status: 'processing',
      template_id: 'default',
      visual_preset_id: 'default',
      voice_profile_id: null,
      image_density: 'high', // More frequent images
      target_resolution: '1080x1920',
      timeline_path: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockScript: Script = {
      title: 'Test Video',
      sections: [
        {
          id: 'section_001',
          order: 0,
          headline: 'Test Section',
          narrationText: 'This is a test section with some content.',
          visualKeywords: ['test'],
          paceHint: 'normal',
          estimatedDurationMs: 10000,
        },
      ],
      totalWordCount: 50,
      estimatedDurationMs: 10000,
      generatedAt: new Date().toISOString(),
    };

    const mockJob = {
      id: testJobId,
      project_id: testProjectId,
      user_id: testUserId,
      status: 'VISUAL_PLAN' as const,
      progress: 40,
      error_code: null,
      error_message: null,
      claimed_at: new Date().toISOString(),
      claimed_by: 'test-worker',
      started_at: new Date().toISOString(),
      finished_at: null,
      cost_credits_reserved: 1,
      cost_credits_final: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const ctx: PipelineContext = {
      job: mockJob,
      project: highDensityProject,
      jobId: testJobId,
      projectId: testProjectId,
      userId: testUserId,
      basePath: `project-assets/u_${testUserId}/p_${testProjectId}/j_${testJobId}`,
      outputPath: `project-outputs/u_${testUserId}/p_${testProjectId}/j_${testJobId}`,
      artifacts: {
        script: mockScript,
        whisperSegments: [{ id: 0, start: 0, end: 10, text: 'Test content' }],
        narrationDurationMs: 10000,
      },
    };

    const result = await planVisuals(ctx);

    expect(result.success).toBe(true);
    expect(result.data?.plan).toBeDefined();

    // High density should have shorter cadence (3-5 seconds)
    expect(result.data!.plan.cadenceMs).toBeLessThan(6000);
  });

  it('should return error when script is missing', async () => {
    const mockProject = {
      id: testProjectId,
      user_id: testUserId,
      title: 'Test Project',
      niche_preset: 'explainer',
      target_minutes: 1,
      status: 'processing',
      template_id: 'default',
      visual_preset_id: 'default',
      voice_profile_id: null,
      image_density: 'normal',
      target_resolution: '1080x1920',
      timeline_path: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockJob = {
      id: testJobId,
      project_id: testProjectId,
      user_id: testUserId,
      status: 'VISUAL_PLAN' as const,
      progress: 40,
      error_code: null,
      error_message: null,
      claimed_at: new Date().toISOString(),
      claimed_by: 'test-worker',
      started_at: new Date().toISOString(),
      finished_at: null,
      cost_credits_reserved: 1,
      cost_credits_final: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const ctx: PipelineContext = {
      job: mockJob,
      project: mockProject,
      jobId: testJobId,
      projectId: testProjectId,
      userId: testUserId,
      basePath: `project-assets/u_${testUserId}/p_${testProjectId}/j_${testJobId}`,
      outputPath: `project-outputs/u_${testUserId}/p_${testProjectId}/j_${testJobId}`,
      artifacts: {}, // No script artifact
    };

    const result = await planVisuals(ctx);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('ERR_VISUAL_PLAN');
    expect(result.error?.message.toLowerCase()).toContain('script');
  });
}, 30000); // 30 second timeout for async operations
