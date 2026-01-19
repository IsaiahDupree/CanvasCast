/**
 * PIPE-005: Image Generation Step Test
 *
 * Acceptance Criteria:
 * - Calls Gemini API (or configured image provider)
 * - Saves images to storage
 * - Handles rate limits
 * - Returns image paths
 * - Processes images in batches
 * - Handles retries on failure
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { PipelineContext, VisualPlan, VisualSlot } from '../../apps/worker/src/pipeline/types';

// Create a mock image generation function
const mockGenerateImage = vi.fn().mockResolvedValue({
  data: [{
    b64_json: Buffer.from('fake-png-image-data-12345').toString('base64'),
  }],
});

// Mock OpenAI module BEFORE importing the module under test
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      images = {
        generate: mockGenerateImage,
      };
    },
  };
});

// NOW import the module under test
import { generateImages } from '../../apps/worker/src/pipeline/steps/generate-images';

describe('PIPE-005: Image Generation Step', () => {
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
      email: `test-pipe005-${Date.now()}@example.com`,
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
        title: 'Test Image Generation Project',
        niche_preset: 'explainer',
        target_minutes: 1,
        image_density: 'normal',
        visual_preset_id: 'photorealistic',
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
        status: 'IMAGE_GEN',
        progress: 50,
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

  it('should generate images from visual plan', async () => {
    // Create mock visual plan
    const mockVisualPlan: VisualPlan = {
      slots: [
        {
          id: 'slot_001',
          startMs: 0,
          endMs: 5000,
          text: 'Welcome to our video about technology',
          prompt: 'photorealistic, high quality, cinematic lighting, technology, innovation, scene depicting: Welcome to our video about technology',
          stylePreset: 'photorealistic',
        },
        {
          id: 'slot_002',
          startMs: 5000,
          endMs: 10000,
          text: 'Today we explore artificial intelligence',
          prompt: 'photorealistic, high quality, cinematic lighting, AI, machine learning, scene depicting: Today we explore artificial intelligence',
          stylePreset: 'photorealistic',
        },
      ],
      totalImages: 2,
      cadenceMs: 5000,
    };

    const mockProject = {
      id: testProjectId,
      user_id: testUserId,
      title: 'Test Image Generation Project',
      niche_preset: 'explainer',
      target_minutes: 1,
      status: 'processing',
      template_id: 'default',
      visual_preset_id: 'photorealistic',
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
      status: 'IMAGE_GEN' as const,
      progress: 50,
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
        visualPlan: mockVisualPlan,
      },
    };

    // Execute the generate-images step
    const result = await generateImages(ctx);

    // Debug output
    if (!result.success) {
      console.error('Image generation failed:', JSON.stringify(result.error, null, 2));
    } else {
      console.log('Image generation succeeded with', result.data?.imagePaths.length, 'images');
    }

    // Assertions
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.imagePaths).toBeDefined();

    const imagePaths = result.data!.imagePaths;

    // Check that we got the correct number of images
    expect(imagePaths).toHaveLength(2);

    // Check that each path is valid
    for (const path of imagePaths) {
      expect(path).toBeDefined();
      expect(typeof path).toBe('string');
      expect(path.length).toBeGreaterThan(0);
      expect(path).toContain('.png');
    }

    // Verify that images were uploaded to storage
    const { data: assetData, error: assetError } = await supabase
      .from('assets')
      .select('*')
      .eq('job_id', testJobId)
      .eq('type', 'image');

    if (assetError) {
      console.error('Asset query error:', assetError);
    }

    expect(assetData).toBeDefined();
    expect(assetData).not.toBeNull();
    expect(assetData!.length).toBe(2);

    // Verify context was updated
    expect(ctx.artifacts.imagePaths).toBeDefined();
    expect(ctx.artifacts.imagePaths).toHaveLength(2);
  }, 60000); // 60 second timeout for image generation

  it('should return error when visual plan is missing', async () => {
    const mockProject = {
      id: testProjectId,
      user_id: testUserId,
      title: 'Test Project',
      niche_preset: 'explainer',
      target_minutes: 1,
      status: 'processing',
      template_id: 'default',
      visual_preset_id: 'photorealistic',
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
      status: 'IMAGE_GEN' as const,
      progress: 50,
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
      artifacts: {}, // No visual plan
    };

    const result = await generateImages(ctx);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('ERR_IMAGE_GEN');
    expect(result.error?.message.toLowerCase()).toContain('visual plan');
  });

  it('should handle batch processing correctly', async () => {
    // Create a visual plan with 5 slots to test batching
    const slots: VisualSlot[] = [];
    for (let i = 0; i < 5; i++) {
      slots.push({
        id: `slot_${String(i + 1).padStart(3, '0')}`,
        startMs: i * 3000,
        endMs: (i + 1) * 3000,
        text: `Test content ${i + 1}`,
        prompt: `photorealistic, high quality, scene depicting: Test content ${i + 1}`,
        stylePreset: 'photorealistic',
      });
    }

    const mockVisualPlan: VisualPlan = {
      slots,
      totalImages: 5,
      cadenceMs: 3000,
    };

    const mockProject = {
      id: testProjectId,
      user_id: testUserId,
      title: 'Batch Test Project',
      niche_preset: 'explainer',
      target_minutes: 1,
      status: 'processing',
      template_id: 'default',
      visual_preset_id: 'photorealistic',
      voice_profile_id: null,
      image_density: 'high',
      target_resolution: '1080x1920',
      timeline_path: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockJob = {
      id: testJobId,
      project_id: testProjectId,
      user_id: testUserId,
      status: 'IMAGE_GEN' as const,
      progress: 50,
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
        visualPlan: mockVisualPlan,
      },
    };

    const result = await generateImages(ctx);

    expect(result.success).toBe(true);
    expect(result.data?.imagePaths).toHaveLength(5);
  }, 120000); // 120 second timeout for batch generation
});
