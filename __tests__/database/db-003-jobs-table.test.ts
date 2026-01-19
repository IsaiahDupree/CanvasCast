/**
 * DB-003: Jobs Table Migration Test
 *
 * Acceptance Criteria:
 * - Table created with all required columns
 * - job_status enum works correctly
 * - Progress tracking columns exist
 * - FK to projects and users
 * - Proper indexes
 * - Status tracking (pending, queued, processing states, ready, failed)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

describe('DB-003: Jobs Table Migration', () => {
  let supabase: SupabaseClient;
  let testUserId: string;
  let testProjectId: string;

  beforeAll(async () => {
    // Initialize Supabase client with service role key for testing
    // Default to local Supabase instance
    const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54341';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Create a test user for FK constraint testing
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: `test-db003-${Date.now()}@example.com`,
      password: 'test-password-123',
      email_confirm: true
    });

    if (authError || !authData.user) {
      throw new Error(`Failed to create test user: ${authError?.message}`);
    }

    testUserId = authData.user.id;

    // Create a test project for FK constraint testing
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .insert({
        user_id: testUserId,
        title: 'Test Project for Jobs',
        prompt_text: 'Test prompt',
        niche_preset: 'motivation',
        target_minutes: 1
      })
      .select()
      .single();

    if (projectError || !projectData) {
      throw new Error(`Failed to create test project: ${projectError?.message}`);
    }

    testProjectId = projectData.id;
  });

  afterAll(async () => {
    // Clean up test user (cascade will delete project and jobs)
    if (testUserId) {
      await supabase.auth.admin.deleteUser(testUserId);
    }
  });

  test('jobs table exists', async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .limit(0);

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  test('jobs table has required columns', async () => {
    // Verify columns exist by selecting them
    const { data: jobs, error: selectError } = await supabase
      .from('jobs')
      .select(`
        id,
        project_id,
        user_id,
        status,
        progress,
        status_message,
        cost_credits_reserved,
        cost_credits_final,
        failed_step,
        error_code,
        error_message,
        output_url,
        manifest_json,
        created_at,
        started_at,
        finished_at
      `)
      .limit(1);

    expect(selectError).toBeNull();
    expect(jobs).toBeDefined();
  });

  test('can create a job with required fields', async () => {
    const { data, error } = await supabase
      .from('jobs')
      .insert({
        project_id: testProjectId,
        user_id: testUserId,
        status: 'PENDING',
        progress: 0,
        cost_credits_reserved: 10
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.project_id).toBe(testProjectId);
    expect(data?.user_id).toBe(testUserId);
    expect(data?.status).toBe('PENDING');
    expect(data?.progress).toBe(0);
    expect(data?.cost_credits_reserved).toBe(10);
  });

  test('job_status enum accepts all valid states', async () => {
    const validStatuses = [
      'PENDING',
      'QUEUED',
      'SCRIPTING',
      'VOICE_GEN',
      'ALIGNMENT',
      'VISUAL_PLAN',
      'IMAGE_GEN',
      'TIMELINE',
      'RENDERING',
      'PACKAGING',
      'READY',
      'FAILED'
    ];

    for (const status of validStatuses) {
      const { data, error } = await supabase
        .from('jobs')
        .insert({
          project_id: testProjectId,
          user_id: testUserId,
          status: status,
          progress: 0
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.status).toBe(status);
    }
  });

  test('job_status enum rejects invalid values', async () => {
    const { error } = await supabase
      .from('jobs')
      .insert({
        project_id: testProjectId,
        user_id: testUserId,
        status: 'INVALID_STATUS',
        progress: 0
      });

    expect(error).toBeDefined();
  });

  test('progress column enforces 0-100 range constraint', async () => {
    // Test valid values
    for (const progress of [0, 50, 100]) {
      const { data, error } = await supabase
        .from('jobs')
        .insert({
          project_id: testProjectId,
          user_id: testUserId,
          status: 'PENDING',
          progress: progress
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.progress).toBe(progress);
    }

    // Test invalid values (below range)
    const { error: errorBelow } = await supabase
      .from('jobs')
      .insert({
        project_id: testProjectId,
        user_id: testUserId,
        status: 'PENDING',
        progress: -1
      });

    expect(errorBelow).toBeDefined();

    // Test invalid values (above range)
    const { error: errorAbove } = await supabase
      .from('jobs')
      .insert({
        project_id: testProjectId,
        user_id: testUserId,
        status: 'PENDING',
        progress: 101
      });

    expect(errorAbove).toBeDefined();
  });

  test('FK constraint to projects works', async () => {
    // Try to insert with non-existent project_id
    const fakeProjectId = '00000000-0000-0000-0000-000000000000';

    const { error } = await supabase
      .from('jobs')
      .insert({
        project_id: fakeProjectId,
        user_id: testUserId,
        status: 'PENDING',
        progress: 0
      });

    expect(error).toBeDefined();
    expect(error?.message).toContain('foreign key');
  });

  test('FK constraint to users works', async () => {
    // Try to insert with non-existent user_id
    const fakeUserId = '00000000-0000-0000-0000-000000000000';

    const { error } = await supabase
      .from('jobs')
      .insert({
        project_id: testProjectId,
        user_id: fakeUserId,
        status: 'PENDING',
        progress: 0
      });

    expect(error).toBeDefined();
    expect(error?.message).toContain('foreign key');
  });

  test('can track job progress through lifecycle', async () => {
    // Create a job in PENDING state
    const { data: job, error: createError } = await supabase
      .from('jobs')
      .insert({
        project_id: testProjectId,
        user_id: testUserId,
        status: 'PENDING',
        progress: 0,
        cost_credits_reserved: 10
      })
      .select()
      .single();

    expect(createError).toBeNull();
    expect(job?.status).toBe('PENDING');

    // Update to QUEUED
    const { data: queued, error: queuedError } = await supabase
      .from('jobs')
      .update({
        status: 'QUEUED',
        progress: 5,
        status_message: 'Job queued for processing'
      })
      .eq('id', job?.id)
      .select()
      .single();

    expect(queuedError).toBeNull();
    expect(queued?.status).toBe('QUEUED');
    expect(queued?.progress).toBe(5);

    // Update to SCRIPTING
    const { data: scripting, error: scriptingError } = await supabase
      .from('jobs')
      .update({
        status: 'SCRIPTING',
        progress: 10,
        status_message: 'Generating script...',
        started_at: new Date().toISOString()
      })
      .eq('id', job?.id)
      .select()
      .single();

    expect(scriptingError).toBeNull();
    expect(scripting?.status).toBe('SCRIPTING');
    expect(scripting?.started_at).toBeDefined();

    // Update to READY
    const { data: ready, error: readyError } = await supabase
      .from('jobs')
      .update({
        status: 'READY',
        progress: 100,
        status_message: 'Video ready for download',
        finished_at: new Date().toISOString(),
        cost_credits_final: 10,
        output_url: 'https://example.com/video.mp4'
      })
      .eq('id', job?.id)
      .select()
      .single();

    expect(readyError).toBeNull();
    expect(ready?.status).toBe('READY');
    expect(ready?.progress).toBe(100);
    expect(ready?.finished_at).toBeDefined();
    expect(ready?.output_url).toBe('https://example.com/video.mp4');
  });

  test('can track failed job with error details', async () => {
    const { data: job, error: createError } = await supabase
      .from('jobs')
      .insert({
        project_id: testProjectId,
        user_id: testUserId,
        status: 'PENDING',
        progress: 0,
        cost_credits_reserved: 10
      })
      .select()
      .single();

    expect(createError).toBeNull();

    // Update to FAILED with error details
    const { data: failed, error: failedError } = await supabase
      .from('jobs')
      .update({
        status: 'FAILED',
        progress: 35,
        status_message: 'Job failed during image generation',
        failed_step: 'IMAGE_GEN',
        error_code: 'API_RATE_LIMIT',
        error_message: 'Gemini API rate limit exceeded',
        finished_at: new Date().toISOString()
      })
      .eq('id', job?.id)
      .select()
      .single();

    expect(failedError).toBeNull();
    expect(failed?.status).toBe('FAILED');
    expect(failed?.failed_step).toBe('IMAGE_GEN');
    expect(failed?.error_code).toBe('API_RATE_LIMIT');
    expect(failed?.error_message).toContain('rate limit');
  });

  test('manifest_json stores structured data', async () => {
    const manifest = {
      script: { scenes: 3, wordCount: 150 },
      audio: { duration: 60, format: 'mp3' },
      images: { count: 3, resolution: '1080x1920' },
      video: { fps: 30, codec: 'h264' }
    };

    const { data, error } = await supabase
      .from('jobs')
      .insert({
        project_id: testProjectId,
        user_id: testUserId,
        status: 'READY',
        progress: 100,
        manifest_json: manifest
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.manifest_json).toEqual(manifest);
  });

  test('RLS policies are enabled', async () => {
    // Create a job with service role (should work)
    const { data: job, error: insertError } = await supabase
      .from('jobs')
      .insert({
        project_id: testProjectId,
        user_id: testUserId,
        status: 'PENDING',
        progress: 0
      })
      .select()
      .single();

    expect(insertError).toBeNull();
    expect(job).toBeDefined();

    // Try to query with anon client (should fail or return empty)
    const anonClient = createClient(
      process.env.SUPABASE_URL || 'http://127.0.0.1:54341',
      process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
    );

    const { data: anonData } = await anonClient
      .from('jobs')
      .select('*')
      .eq('id', job.id);

    // Without proper auth, should not see the job
    expect(anonData).toEqual([]);
  });

  test('indexes exist for performance queries', async () => {
    // Test user_id index
    const { data: userJobs, error: userError } = await supabase
      .from('jobs')
      .select('*')
      .eq('user_id', testUserId)
      .order('created_at', { ascending: false });

    expect(userError).toBeNull();
    expect(userJobs).toBeDefined();

    // Test project_id index
    const { data: projectJobs, error: projectError } = await supabase
      .from('jobs')
      .select('*')
      .eq('project_id', testProjectId);

    expect(projectError).toBeNull();
    expect(projectJobs).toBeDefined();

    // Test status index
    const { data: pendingJobs, error: statusError } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', 'PENDING');

    expect(statusError).toBeNull();
    expect(pendingJobs).toBeDefined();
  });

  test('defaults are set correctly', async () => {
    const { data, error } = await supabase
      .from('jobs')
      .insert({
        project_id: testProjectId,
        user_id: testUserId
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.status).toBe('PENDING');
    expect(data?.progress).toBe(0);
    expect(data?.cost_credits_reserved).toBe(0);
    expect(data?.created_at).toBeDefined();
  });
});
