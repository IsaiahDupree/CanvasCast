/**
 * Integration tests for draft prompt RPC functions
 * Tests claim_draft_prompt and cleanup_expired_drafts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Skip tests if Supabase is not configured
const skipTests = !supabaseServiceKey || !supabaseUrl;

describe('Draft Prompt RPC Functions', () => {
  let supabase: ReturnType<typeof createClient>;
  let testUserId: string;
  let sessionToken: string;

  beforeAll(() => {
    if (skipTests) {
      console.log('Skipping draft functions tests - Supabase not configured');
      return;
    }

    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  });

  beforeEach(async () => {
    if (skipTests) return;

    // Generate a test session token
    sessionToken = `test-session-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Create a test user (using service role to bypass RLS)
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email: `test-${Date.now()}@example.com`,
      email_confirm: true,
    });

    if (userError) {
      throw new Error(`Failed to create test user: ${userError.message}`);
    }

    testUserId = userData.user.id;
  });

  afterEach(async () => {
    if (skipTests) return;

    // Clean up test data
    if (testUserId) {
      // Delete draft prompts associated with test user
      await supabase
        .from('draft_prompts')
        .delete()
        .eq('claimed_by_user_id', testUserId);

      // Delete draft prompts with test session token
      await supabase
        .from('draft_prompts')
        .delete()
        .eq('session_token', sessionToken);

      // Delete test user
      await supabase.auth.admin.deleteUser(testUserId);
    }
  });

  describe('claim_draft_prompt', () => {
    it('should claim an unclaimed draft and return its ID', async () => {
      if (skipTests) return;

      // Create a draft prompt
      const { data: draft, error: draftError } = await supabase
        .from('draft_prompts')
        .insert({
          session_token: sessionToken,
          prompt_text: 'Test prompt for claiming',
          template_id: 'narrated_storyboard_v1',
        })
        .select()
        .single();

      expect(draftError).toBeNull();
      expect(draft).toBeTruthy();

      // Call the claim function
      const { data: claimedId, error: claimError } = await supabase.rpc(
        'claim_draft_prompt',
        {
          p_session_token: sessionToken,
          p_user_id: testUserId,
        }
      );

      expect(claimError).toBeNull();
      expect(claimedId).toBe(draft.id);

      // Verify the draft was claimed
      const { data: updatedDraft, error: fetchError } = await supabase
        .from('draft_prompts')
        .select()
        .eq('id', draft.id)
        .single();

      expect(fetchError).toBeNull();
      expect(updatedDraft.claimed_by_user_id).toBe(testUserId);
      expect(updatedDraft.updated_at).not.toBe(draft.updated_at);
    });

    it('should return null for non-existent session token', async () => {
      if (skipTests) return;

      const { data: claimedId, error: claimError } = await supabase.rpc(
        'claim_draft_prompt',
        {
          p_session_token: 'non-existent-token',
          p_user_id: testUserId,
        }
      );

      expect(claimError).toBeNull();
      expect(claimedId).toBeNull();
    });

    it('should not claim an already claimed draft', async () => {
      if (skipTests) return;

      // Create a draft prompt and claim it
      const { data: draft, error: draftError } = await supabase
        .from('draft_prompts')
        .insert({
          session_token: sessionToken,
          prompt_text: 'Already claimed prompt',
          template_id: 'narrated_storyboard_v1',
        })
        .select()
        .single();

      expect(draftError).toBeNull();

      // First claim
      const { data: firstClaimId } = await supabase.rpc('claim_draft_prompt', {
        p_session_token: sessionToken,
        p_user_id: testUserId,
      });

      expect(firstClaimId).toBe(draft.id);

      // Create another user to attempt second claim
      const { data: user2Data } = await supabase.auth.admin.createUser({
        email: `test2-${Date.now()}@example.com`,
        email_confirm: true,
      });

      const user2Id = user2Data.user.id;

      // Attempt to claim again with different user
      const { data: secondClaimId } = await supabase.rpc('claim_draft_prompt', {
        p_session_token: sessionToken,
        p_user_id: user2Id,
      });

      expect(secondClaimId).toBeNull();

      // Cleanup
      await supabase.auth.admin.deleteUser(user2Id);
    });

    it('should not claim an expired draft', async () => {
      if (skipTests) return;

      // Create an expired draft (expires_at in the past)
      const { data: draft, error: draftError } = await supabase
        .from('draft_prompts')
        .insert({
          session_token: sessionToken,
          prompt_text: 'Expired prompt',
          template_id: 'narrated_storyboard_v1',
          expires_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        })
        .select()
        .single();

      expect(draftError).toBeNull();

      // Attempt to claim
      const { data: claimedId } = await supabase.rpc('claim_draft_prompt', {
        p_session_token: sessionToken,
        p_user_id: testUserId,
      });

      expect(claimedId).toBeNull();
    });
  });

  describe('cleanup_expired_drafts', () => {
    it('should delete expired unclaimed drafts and return count', async () => {
      if (skipTests) return;

      // Create some expired unclaimed drafts
      const expiredDrafts = [
        {
          session_token: `expired-1-${Date.now()}`,
          prompt_text: 'Expired draft 1',
          expires_at: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          session_token: `expired-2-${Date.now()}`,
          prompt_text: 'Expired draft 2',
          expires_at: new Date(Date.now() - 172800000).toISOString(),
        },
      ];

      const { error: insertError } = await supabase
        .from('draft_prompts')
        .insert(expiredDrafts);

      expect(insertError).toBeNull();

      // Create a non-expired draft (should not be deleted)
      const { data: validDraft } = await supabase
        .from('draft_prompts')
        .insert({
          session_token: `valid-${Date.now()}`,
          prompt_text: 'Valid draft',
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        })
        .select()
        .single();

      // Create an expired but claimed draft (should not be deleted)
      const { data: claimedDraft } = await supabase
        .from('draft_prompts')
        .insert({
          session_token: `claimed-${Date.now()}`,
          prompt_text: 'Claimed but expired draft',
          expires_at: new Date(Date.now() - 86400000).toISOString(),
          claimed_by_user_id: testUserId,
        })
        .select()
        .single();

      // Run cleanup
      const { data: deletedCount, error: cleanupError } = await supabase.rpc(
        'cleanup_expired_drafts'
      );

      expect(cleanupError).toBeNull();
      expect(deletedCount).toBe(2);

      // Verify expired drafts were deleted
      const { data: expiredCheck } = await supabase
        .from('draft_prompts')
        .select()
        .in('session_token', [expiredDrafts[0].session_token, expiredDrafts[1].session_token]);

      expect(expiredCheck).toHaveLength(0);

      // Verify valid draft still exists
      const { data: validCheck } = await supabase
        .from('draft_prompts')
        .select()
        .eq('id', validDraft.id)
        .single();

      expect(validCheck).toBeTruthy();

      // Verify claimed draft still exists
      const { data: claimedCheck } = await supabase
        .from('draft_prompts')
        .select()
        .eq('id', claimedDraft.id)
        .single();

      expect(claimedCheck).toBeTruthy();

      // Cleanup
      await supabase.from('draft_prompts').delete().eq('id', validDraft.id);
      await supabase.from('draft_prompts').delete().eq('id', claimedDraft.id);
    });

    it('should return 0 when no expired drafts exist', async () => {
      if (skipTests) return;

      const { data: deletedCount, error: cleanupError } = await supabase.rpc(
        'cleanup_expired_drafts'
      );

      expect(cleanupError).toBeNull();
      expect(deletedCount).toBe(0);
    });
  });
});
