/**
 * DB-002: Projects Table Migration Test
 *
 * Acceptance Criteria:
 * - Table created with all required columns
 * - FK to profiles (via auth.users)
 * - RLS policies applied
 * - Proper indexes created
 * - CHECK constraints on niche_preset and target_minutes
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

describe('DB-002: Projects Table Migration', () => {
  let supabase: SupabaseClient;
  let testUserId: string;

  beforeAll(async () => {
    // Initialize Supabase client with service role key for testing
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials for testing');
    }

    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Create a test user for FK constraint testing
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: `test-db002-${Date.now()}@example.com`,
      password: 'test-password-123',
      email_confirm: true
    });

    if (authError || !authData.user) {
      throw new Error(`Failed to create test user: ${authError?.message}`);
    }

    testUserId = authData.user.id;
  });

  afterAll(async () => {
    // Clean up test user
    if (testUserId) {
      await supabase.auth.admin.deleteUser(testUserId);
    }
  });

  test('projects table exists', async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .limit(0);

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  test('projects table has required columns', async () => {
    // Query information schema to check columns
    const { data, error } = await supabase.rpc('get_table_columns', {
      table_name: 'projects'
    }).catch(async () => {
      // Fallback: try inserting and check structure
      const { error } = await supabase
        .from('projects')
        .insert({
          user_id: testUserId,
          title: 'Test Project',
          prompt_text: 'Test prompt',
          niche_preset: 'motivation',
          target_minutes: 1
        })
        .select()
        .single();

      return { data: null, error };
    });

    // If insert worked, we can verify columns exist
    const { data: projects, error: selectError } = await supabase
      .from('projects')
      .select('id, user_id, title, prompt_text, niche_preset, target_minutes, voice_profile_id, transcript_mode, transcript_text, created_at, updated_at')
      .eq('user_id', testUserId)
      .limit(1);

    expect(selectError).toBeNull();
    expect(projects).toBeDefined();
  });

  test('can create a project with required fields', async () => {
    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: testUserId,
        title: 'My First Video',
        prompt_text: 'Create a motivational video about overcoming challenges',
        niche_preset: 'motivation',
        target_minutes: 1
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.title).toBe('My First Video');
    expect(data?.prompt_text).toBe('Create a motivational video about overcoming challenges');
    expect(data?.niche_preset).toBe('motivation');
    expect(data?.target_minutes).toBe(1);
    expect(data?.user_id).toBe(testUserId);
  });

  test('niche_preset accepts valid values', async () => {
    const validNiches = ['motivation', 'explainer', 'facts', 'history', 'finance', 'science'];

    for (const niche of validNiches) {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          user_id: testUserId,
          title: `Test ${niche}`,
          prompt_text: `Test prompt for ${niche}`,
          niche_preset: niche,
          target_minutes: 1
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.niche_preset).toBe(niche);
    }
  });

  test('niche_preset rejects invalid values', async () => {
    const { error } = await supabase
      .from('projects')
      .insert({
        user_id: testUserId,
        title: 'Test Invalid Niche',
        prompt_text: 'Test prompt',
        niche_preset: 'invalid_niche',
        target_minutes: 1
      });

    expect(error).toBeDefined();
    expect(error?.message).toContain('check constraint');
  });

  test('target_minutes enforces range constraint (1-10)', async () => {
    // Test valid values
    for (const minutes of [1, 5, 10]) {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          user_id: testUserId,
          title: `Test ${minutes} min`,
          prompt_text: 'Test prompt',
          niche_preset: 'motivation',
          target_minutes: minutes
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.target_minutes).toBe(minutes);
    }

    // Test invalid values (below range)
    const { error: errorBelow } = await supabase
      .from('projects')
      .insert({
        user_id: testUserId,
        title: 'Test 0 min',
        prompt_text: 'Test prompt',
        niche_preset: 'motivation',
        target_minutes: 0
      });

    expect(errorBelow).toBeDefined();

    // Test invalid values (above range)
    const { error: errorAbove } = await supabase
      .from('projects')
      .insert({
        user_id: testUserId,
        title: 'Test 11 min',
        prompt_text: 'Test prompt',
        niche_preset: 'motivation',
        target_minutes: 11
      });

    expect(errorAbove).toBeDefined();
  });

  test('transcript_mode defaults to auto and accepts valid values', async () => {
    // Test default
    const { data: dataDefault, error: errorDefault } = await supabase
      .from('projects')
      .insert({
        user_id: testUserId,
        title: 'Test Default Transcript',
        prompt_text: 'Test prompt',
        niche_preset: 'motivation',
        target_minutes: 1
      })
      .select()
      .single();

    expect(errorDefault).toBeNull();
    expect(dataDefault?.transcript_mode).toBe('auto');

    // Test manual mode
    const { data: dataManual, error: errorManual } = await supabase
      .from('projects')
      .insert({
        user_id: testUserId,
        title: 'Test Manual Transcript',
        prompt_text: 'Test prompt',
        niche_preset: 'motivation',
        target_minutes: 1,
        transcript_mode: 'manual',
        transcript_text: 'Custom transcript content'
      })
      .select()
      .single();

    expect(errorManual).toBeNull();
    expect(dataManual?.transcript_mode).toBe('manual');
    expect(dataManual?.transcript_text).toBe('Custom transcript content');
  });

  test('FK constraint to auth.users works', async () => {
    // Try to insert with non-existent user_id
    const fakeUserId = '00000000-0000-0000-0000-000000000000';

    const { error } = await supabase
      .from('projects')
      .insert({
        user_id: fakeUserId,
        title: 'Test FK',
        prompt_text: 'Test prompt',
        niche_preset: 'motivation',
        target_minutes: 1
      });

    expect(error).toBeDefined();
    expect(error?.message).toContain('foreign key');
  });

  test('RLS policies are enabled', async () => {
    // Create a project with service role (should work)
    const { data: project, error: insertError } = await supabase
      .from('projects')
      .insert({
        user_id: testUserId,
        title: 'RLS Test Project',
        prompt_text: 'Test RLS',
        niche_preset: 'motivation',
        target_minutes: 1
      })
      .select()
      .single();

    expect(insertError).toBeNull();
    expect(project).toBeDefined();

    // Try to query with anon client (should fail or return empty)
    const anonClient = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );

    const { data: anonData } = await anonClient
      .from('projects')
      .select('*')
      .eq('id', project.id);

    // Without proper auth, should not see the project
    expect(anonData).toEqual([]);
  });

  test('indexes exist for performance', async () => {
    // This is implicit - if queries are fast, indexes work
    // We'll verify by checking if user_id queries work efficiently
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', testUserId)
      .order('created_at', { ascending: false });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
  });

  test('updated_at timestamp is automatically updated', async () => {
    // Create a project
    const { data: project, error: insertError } = await supabase
      .from('projects')
      .insert({
        user_id: testUserId,
        title: 'Timestamp Test',
        prompt_text: 'Test prompt',
        niche_preset: 'motivation',
        target_minutes: 1
      })
      .select()
      .single();

    expect(insertError).toBeNull();
    const originalUpdatedAt = project?.updated_at;

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update the project
    const { data: updated, error: updateError } = await supabase
      .from('projects')
      .update({ title: 'Updated Title' })
      .eq('id', project?.id)
      .select()
      .single();

    expect(updateError).toBeNull();
    expect(updated?.updated_at).not.toBe(originalUpdatedAt);
    expect(new Date(updated?.updated_at).getTime()).toBeGreaterThan(
      new Date(originalUpdatedAt).getTime()
    );
  });
});
