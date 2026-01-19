/**
 * DB-008: Assets Table Migration Test
 *
 * Acceptance Criteria:
 * - Table created with all required columns
 * - FK to jobs
 * - Asset types enum works
 * - Proper indexes on job_id and type
 * - RLS policies enabled
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

describe('DB-008: Assets Table Migration', () => {
  let supabase: SupabaseClient;
  let testUserId: string;
  let testProjectId: string;
  let testJobId: string;

  beforeAll(async () => {
    // Initialize Supabase client with service role key for testing
    const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54341';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Create a test user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: `test-db008-${Date.now()}@example.com`,
      password: 'test-password-123',
      email_confirm: true
    });

    if (authError || !authData.user) {
      throw new Error(`Failed to create test user: ${authError?.message}`);
    }

    testUserId = authData.user.id;

    // Create a test project
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .insert({
        user_id: testUserId,
        title: 'Test Project for Assets',
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

    // Create a test job
    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .insert({
        project_id: testProjectId,
        user_id: testUserId,
        status: 'PENDING',
        progress: 0
      })
      .select()
      .single();

    if (jobError || !jobData) {
      throw new Error(`Failed to create test job: ${jobError?.message}`);
    }

    testJobId = jobData.id;
  });

  afterAll(async () => {
    // Clean up test user (cascade will delete project, jobs, and assets)
    if (testUserId) {
      await supabase.auth.admin.deleteUser(testUserId);
    }
  });

  test('assets table exists', async () => {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .limit(0);

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  test('assets table has required columns', async () => {
    // Verify columns exist by selecting them
    const { data: assets, error: selectError } = await supabase
      .from('assets')
      .select(`
        id,
        job_id,
        type,
        url,
        storage_path,
        size_bytes,
        mime_type,
        metadata_json,
        created_at
      `)
      .limit(1);

    expect(selectError).toBeNull();
    expect(assets).toBeDefined();
  });

  test('can create an asset with required fields', async () => {
    const { data, error } = await supabase
      .from('assets')
      .insert({
        job_id: testJobId,
        type: 'video',
        url: 'https://example.com/video.mp4',
        storage_path: 'generated-assets/video.mp4',
        size_bytes: 1024000,
        mime_type: 'video/mp4'
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.job_id).toBe(testJobId);
    expect(data?.type).toBe('video');
    expect(data?.url).toBe('https://example.com/video.mp4');
    expect(data?.storage_path).toBe('generated-assets/video.mp4');
    expect(data?.size_bytes).toBe(1024000);
    expect(data?.mime_type).toBe('video/mp4');
  });

  test('asset type enum accepts all valid types', async () => {
    const validTypes = ['video', 'audio', 'image', 'captions', 'manifest', 'zip'];

    for (const type of validTypes) {
      const { data, error } = await supabase
        .from('assets')
        .insert({
          job_id: testJobId,
          type: type,
          url: `https://example.com/${type}.file`,
          storage_path: `generated-assets/${type}.file`
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.type).toBe(type);
    }
  });

  test('asset type enum rejects invalid values', async () => {
    const { error } = await supabase
      .from('assets')
      .insert({
        job_id: testJobId,
        type: 'invalid_type',
        url: 'https://example.com/file.txt',
        storage_path: 'generated-assets/file.txt'
      });

    expect(error).toBeDefined();
  });

  test('FK constraint to jobs works', async () => {
    // Try to insert with non-existent job_id
    const fakeJobId = '00000000-0000-0000-0000-000000000000';

    const { error } = await supabase
      .from('assets')
      .insert({
        job_id: fakeJobId,
        type: 'video',
        url: 'https://example.com/video.mp4',
        storage_path: 'generated-assets/video.mp4'
      });

    expect(error).toBeDefined();
    expect(error?.message).toContain('foreign key');
  });

  test('metadata_json stores structured data', async () => {
    const metadata = {
      width: 1080,
      height: 1920,
      duration: 60,
      fps: 30,
      codec: 'h264'
    };

    const { data, error } = await supabase
      .from('assets')
      .insert({
        job_id: testJobId,
        type: 'video',
        url: 'https://example.com/video.mp4',
        storage_path: 'generated-assets/video.mp4',
        metadata_json: metadata
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.metadata_json).toEqual(metadata);
  });

  test('can query assets by job_id', async () => {
    // Create multiple assets for the test job
    const assetTypes = ['video', 'audio', 'image'];

    for (const type of assetTypes) {
      await supabase
        .from('assets')
        .insert({
          job_id: testJobId,
          type: type,
          url: `https://example.com/${type}.file`,
          storage_path: `generated-assets/${type}.file`
        });
    }

    // Query assets by job_id
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('job_id', testJobId);

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data!.length).toBeGreaterThanOrEqual(assetTypes.length);
  });

  test('can query assets by type', async () => {
    // Create a specific asset type
    await supabase
      .from('assets')
      .insert({
        job_id: testJobId,
        type: 'captions',
        url: 'https://example.com/captions.vtt',
        storage_path: 'generated-assets/captions.vtt'
      });

    // Query by type
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('type', 'captions');

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data!.every(asset => asset.type === 'captions')).toBe(true);
  });

  test('RLS policies are enabled', async () => {
    // Create an asset with service role (should work)
    const { data: asset, error: insertError } = await supabase
      .from('assets')
      .insert({
        job_id: testJobId,
        type: 'video',
        url: 'https://example.com/video.mp4',
        storage_path: 'generated-assets/video.mp4'
      })
      .select()
      .single();

    expect(insertError).toBeNull();
    expect(asset).toBeDefined();

    // Try to query with anon client (should fail or return empty without proper auth)
    const anonClient = createClient(
      process.env.SUPABASE_URL || 'http://127.0.0.1:54341',
      process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
    );

    const { data: anonData } = await anonClient
      .from('assets')
      .select('*')
      .eq('id', asset.id);

    // Without proper auth, should not see the asset
    expect(anonData).toEqual([]);
  });

  test('defaults are set correctly', async () => {
    const { data, error } = await supabase
      .from('assets')
      .insert({
        job_id: testJobId,
        type: 'video',
        url: 'https://example.com/video.mp4',
        storage_path: 'generated-assets/video.mp4'
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.created_at).toBeDefined();
    expect(data?.metadata_json).toEqual({});
  });

  test('cascade delete when job is deleted', async () => {
    // Create a new job and asset
    const { data: newJob } = await supabase
      .from('jobs')
      .insert({
        project_id: testProjectId,
        user_id: testUserId,
        status: 'PENDING'
      })
      .select()
      .single();

    const { data: newAsset } = await supabase
      .from('assets')
      .insert({
        job_id: newJob!.id,
        type: 'video',
        url: 'https://example.com/video.mp4',
        storage_path: 'generated-assets/video.mp4'
      })
      .select()
      .single();

    expect(newAsset).toBeDefined();

    // Delete the job
    await supabase
      .from('jobs')
      .delete()
      .eq('id', newJob!.id);

    // Verify asset was cascade deleted
    const { data: deletedAsset } = await supabase
      .from('assets')
      .select('*')
      .eq('id', newAsset!.id);

    expect(deletedAsset).toEqual([]);
  });
});
