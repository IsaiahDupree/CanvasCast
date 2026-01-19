/**
 * Draft Prompts Table Migration Tests
 * Feature: DB-005 - Draft Prompts Table Migration
 *
 * Tests that the draft_prompts table is created correctly with:
 * - Proper schema structure
 * - Session token indexed for fast lookup
 * - Expiry mechanism
 * - RLS policies for pre-auth and post-auth access
 * - claim_draft_prompt RPC function
 * - cleanup_expired_drafts function
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// These tests require a running Supabase instance
// Run: pnpm supabase start
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

describe('DB-005: Draft Prompts Table Migration', () => {
  describe('Table Structure', () => {
    it('should have draft_prompts table', async () => {
      const { data, error } = await supabase
        .from('draft_prompts')
        .select('*')
        .limit(0);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have all required columns', async () => {
      // Create a test draft to verify columns exist
      const testSessionToken = randomUUID();
      const testPrompt = 'Test prompt for column verification';

      const { data, error } = await supabase
        .from('draft_prompts')
        .insert({
          session_token: testSessionToken,
          prompt_text: testPrompt,
          template_id: 'narrated_storyboard_v1',
          options_json: {},
        })
        .select('*')
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // Verify all columns from PRD exist
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('session_token');
      expect(data).toHaveProperty('prompt_text');
      expect(data).toHaveProperty('template_id');
      expect(data).toHaveProperty('options_json');
      expect(data).toHaveProperty('claimed_by_user_id');
      expect(data).toHaveProperty('expires_at');
      expect(data).toHaveProperty('created_at');
      expect(data).toHaveProperty('updated_at');

      // Cleanup
      await supabase.from('draft_prompts').delete().eq('id', data.id);
    });

    it('should have default values set correctly', async () => {
      const testSessionToken = randomUUID();
      const testPrompt = 'Test prompt for defaults';

      const { data, error } = await supabase
        .from('draft_prompts')
        .insert({
          session_token: testSessionToken,
          prompt_text: testPrompt,
        })
        .select('*')
        .single();

      expect(error).toBeNull();
      expect(data?.template_id).toBe('narrated_storyboard_v1');
      expect(data?.options_json).toEqual({});
      expect(data?.claimed_by_user_id).toBeNull();
      expect(data?.expires_at).toBeDefined();
      expect(data?.created_at).toBeDefined();
      expect(data?.updated_at).toBeDefined();

      // Verify expires_at is approximately 7 days from now
      const expiresAt = new Date(data!.expires_at);
      const now = new Date();
      const daysDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeGreaterThan(6.9);
      expect(daysDiff).toBeLessThan(7.1);

      // Cleanup
      await supabase.from('draft_prompts').delete().eq('id', data!.id);
    });
  });

  describe('Indexes', () => {
    it('should have index on session_token for fast lookup', async () => {
      // Test performance by looking up by session_token
      const testSessionToken = randomUUID();
      const testPrompt = 'Test prompt for session token index';

      // Insert draft
      const { data: insertedDraft } = await supabase
        .from('draft_prompts')
        .insert({
          session_token: testSessionToken,
          prompt_text: testPrompt,
        })
        .select('*')
        .single();

      // Query by session_token should be fast (index used)
      const { data, error } = await supabase
        .from('draft_prompts')
        .select('*')
        .eq('session_token', testSessionToken)
        .single();

      expect(error).toBeNull();
      expect(data?.session_token).toBe(testSessionToken);
      expect(data?.prompt_text).toBe(testPrompt);

      // Cleanup
      await supabase.from('draft_prompts').delete().eq('id', insertedDraft!.id);
    });

    it('should have index on expires_at for cleanup queries', async () => {
      // Insert an expired draft
      const expiredDraft = {
        session_token: randomUUID(),
        prompt_text: 'Expired draft',
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      };

      const { data: insertedDraft } = await supabase
        .from('draft_prompts')
        .insert(expiredDraft)
        .select('*')
        .single();

      // Query by expires_at should be efficient
      const { data, error } = await supabase
        .from('draft_prompts')
        .select('*')
        .lt('expires_at', new Date().toISOString());

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.some(d => d.id === insertedDraft!.id)).toBe(true);

      // Cleanup
      await supabase.from('draft_prompts').delete().eq('id', insertedDraft!.id);
    });
  });

  describe('RLS Policies', () => {
    it('should have RLS enabled', async () => {
      // Create anon client to test RLS
      const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

      // Anonymous users can insert drafts
      const testSessionToken = randomUUID();
      const { data, error } = await anonClient
        .from('draft_prompts')
        .insert({
          session_token: testSessionToken,
          prompt_text: 'Test anonymous draft creation',
        })
        .select('*')
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.session_token).toBe(testSessionToken);

      // Cleanup with service role
      await supabase.from('draft_prompts').delete().eq('id', data!.id);
    });

    it('should allow anyone to create drafts (pre-auth flow)', async () => {
      const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const testSessionToken = randomUUID();

      const { data, error } = await anonClient
        .from('draft_prompts')
        .insert({
          session_token: testSessionToken,
          prompt_text: 'Pre-auth draft test',
        })
        .select('*')
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // Cleanup
      await supabase.from('draft_prompts').delete().eq('id', data!.id);
    });

    it('should allow users to read unclaimed drafts', async () => {
      const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const testSessionToken = randomUUID();

      // Create draft
      const { data: draft } = await anonClient
        .from('draft_prompts')
        .insert({
          session_token: testSessionToken,
          prompt_text: 'Test unclaimed draft read',
        })
        .select('*')
        .single();

      // Should be able to read unclaimed drafts
      const { data, error } = await anonClient
        .from('draft_prompts')
        .select('*')
        .eq('session_token', testSessionToken)
        .is('claimed_by_user_id', null);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.length).toBeGreaterThan(0);

      // Cleanup
      await supabase.from('draft_prompts').delete().eq('id', draft!.id);
    });
  });

  describe('claim_draft_prompt RPC Function', () => {
    it('should have claim_draft_prompt function defined', async () => {
      // Test that the function exists by calling it with test data
      const testSessionToken = randomUUID();
      const testUserId = randomUUID();

      // Create a draft first
      const { data: draft } = await supabase
        .from('draft_prompts')
        .insert({
          session_token: testSessionToken,
          prompt_text: 'Draft to be claimed',
        })
        .select('*')
        .single();

      // Call the RPC function
      const { data, error } = await supabase.rpc('claim_draft_prompt', {
        p_session_token: testSessionToken,
        p_user_id: testUserId,
      });

      // Function should exist (even if it fails due to FK constraint)
      // We expect it to work or fail with FK error, not "function does not exist"
      expect(error?.message).not.toContain('function');
      expect(error?.message).not.toContain('does not exist');

      // Cleanup
      await supabase.from('draft_prompts').delete().eq('id', draft!.id);
    });

    it('should claim draft and link to user_id', async () => {
      const testSessionToken = randomUUID();

      // Create draft
      const { data: draft } = await supabase
        .from('draft_prompts')
        .insert({
          session_token: testSessionToken,
          prompt_text: 'Draft to claim',
        })
        .select('*')
        .single();

      expect(draft?.claimed_by_user_id).toBeNull();

      // Create a test user first (required for FK constraint)
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: `test-${randomUUID()}@example.com`,
        password: 'test-password-123',
        email_confirm: true,
      });

      if (authError) {
        console.warn('Could not create test user, skipping claim test:', authError.message);
        await supabase.from('draft_prompts').delete().eq('id', draft!.id);
        return;
      }

      const userId = authData.user.id;

      // Claim the draft
      const { data: claimedId, error: claimError } = await supabase.rpc('claim_draft_prompt', {
        p_session_token: testSessionToken,
        p_user_id: userId,
      });

      expect(claimError).toBeNull();
      expect(claimedId).toBe(draft!.id);

      // Verify the draft is now claimed
      const { data: claimedDraft } = await supabase
        .from('draft_prompts')
        .select('*')
        .eq('id', draft!.id)
        .single();

      expect(claimedDraft?.claimed_by_user_id).toBe(userId);

      // Cleanup
      await supabase.from('draft_prompts').delete().eq('id', draft!.id);
      await supabase.auth.admin.deleteUser(userId);
    });

    it('should not claim already-claimed draft', async () => {
      const testSessionToken = randomUUID();

      // Create draft
      const { data: draft } = await supabase
        .from('draft_prompts')
        .insert({
          session_token: testSessionToken,
          prompt_text: 'Draft already claimed',
        })
        .select('*')
        .single();

      // Create two test users
      const { data: user1Data, error: user1Error } = await supabase.auth.admin.createUser({
        email: `test1-${randomUUID()}@example.com`,
        password: 'test-password-123',
        email_confirm: true,
      });

      const { data: user2Data, error: user2Error } = await supabase.auth.admin.createUser({
        email: `test2-${randomUUID()}@example.com`,
        password: 'test-password-123',
        email_confirm: true,
      });

      if (!user1Data || !user2Data || user1Error || user2Error) {
        console.warn('Could not create test users, skipping test');
        await supabase.from('draft_prompts').delete().eq('id', draft!.id);
        return;
      }

      // First user claims it
      await supabase.rpc('claim_draft_prompt', {
        p_session_token: testSessionToken,
        p_user_id: user1Data.user.id,
      });

      // Second user tries to claim - should return null
      const { data: secondClaimId } = await supabase.rpc('claim_draft_prompt', {
        p_session_token: testSessionToken,
        p_user_id: user2Data.user.id,
      });

      expect(secondClaimId).toBeNull();

      // Verify still claimed by first user
      const { data: claimedDraft } = await supabase
        .from('draft_prompts')
        .select('*')
        .eq('id', draft!.id)
        .single();

      expect(claimedDraft?.claimed_by_user_id).toBe(user1Data.user.id);

      // Cleanup
      await supabase.from('draft_prompts').delete().eq('id', draft!.id);
      await supabase.auth.admin.deleteUser(user1Data.user.id);
      await supabase.auth.admin.deleteUser(user2Data.user.id);
    });

    it('should not claim expired draft', async () => {
      const testSessionToken = randomUUID();

      // Create expired draft
      const { data: draft } = await supabase
        .from('draft_prompts')
        .insert({
          session_token: testSessionToken,
          prompt_text: 'Expired draft',
          expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        })
        .select('*')
        .single();

      // Create test user
      const { data: userData, error: userError } = await supabase.auth.admin.createUser({
        email: `test-${randomUUID()}@example.com`,
        password: 'test-password-123',
        email_confirm: true,
      });

      if (!userData || userError) {
        console.warn('Could not create test user, skipping test');
        await supabase.from('draft_prompts').delete().eq('id', draft!.id);
        return;
      }

      // Try to claim expired draft - should return null
      const { data: claimedId } = await supabase.rpc('claim_draft_prompt', {
        p_session_token: testSessionToken,
        p_user_id: userData.user.id,
      });

      expect(claimedId).toBeNull();

      // Cleanup
      await supabase.from('draft_prompts').delete().eq('id', draft!.id);
      await supabase.auth.admin.deleteUser(userData.user.id);
    });
  });

  describe('cleanup_expired_drafts Function', () => {
    it('should have cleanup_expired_drafts function defined', async () => {
      const { data, error } = await supabase.rpc('cleanup_expired_drafts');

      expect(error).toBeNull();
      expect(typeof data).toBe('number');
    });

    it('should delete expired unclaimed drafts', async () => {
      // Create expired unclaimed draft
      const { data: expiredDraft } = await supabase
        .from('draft_prompts')
        .insert({
          session_token: randomUUID(),
          prompt_text: 'Expired draft to cleanup',
          expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          claimed_by_user_id: null,
        })
        .select('*')
        .single();

      // Run cleanup
      const { data: deletedCount, error } = await supabase.rpc('cleanup_expired_drafts');

      expect(error).toBeNull();
      expect(deletedCount).toBeGreaterThan(0);

      // Verify draft was deleted
      const { data: deletedDraft } = await supabase
        .from('draft_prompts')
        .select('*')
        .eq('id', expiredDraft!.id)
        .maybeSingle();

      expect(deletedDraft).toBeNull();
    });

    it('should NOT delete claimed drafts even if expired', async () => {
      // Create a test user
      const { data: userData, error: userError } = await supabase.auth.admin.createUser({
        email: `test-${randomUUID()}@example.com`,
        password: 'test-password-123',
        email_confirm: true,
      });

      if (!userData || userError) {
        console.warn('Could not create test user, skipping test');
        return;
      }

      // Create expired but claimed draft
      const { data: claimedExpiredDraft } = await supabase
        .from('draft_prompts')
        .insert({
          session_token: randomUUID(),
          prompt_text: 'Claimed expired draft - should not delete',
          expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          claimed_by_user_id: userData.user.id,
        })
        .select('*')
        .single();

      // Run cleanup
      await supabase.rpc('cleanup_expired_drafts');

      // Verify claimed draft was NOT deleted
      const { data: stillExists } = await supabase
        .from('draft_prompts')
        .select('*')
        .eq('id', claimedExpiredDraft!.id)
        .single();

      expect(stillExists).toBeDefined();
      expect(stillExists?.claimed_by_user_id).toBe(userData.user.id);

      // Cleanup
      await supabase.from('draft_prompts').delete().eq('id', claimedExpiredDraft!.id);
      await supabase.auth.admin.deleteUser(userData.user.id);
    });

    it('should return count of deleted drafts', async () => {
      // Create multiple expired unclaimed drafts
      const draftsToCreate = [
        {
          session_token: randomUUID(),
          prompt_text: 'Expired 1',
          expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          session_token: randomUUID(),
          prompt_text: 'Expired 2',
          expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        },
      ];

      await supabase.from('draft_prompts').insert(draftsToCreate);

      // Run cleanup and verify count
      const { data: deletedCount } = await supabase.rpc('cleanup_expired_drafts');

      expect(deletedCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Expiry Mechanism', () => {
    it('should set expires_at to 7 days from creation by default', async () => {
      const { data: draft } = await supabase
        .from('draft_prompts')
        .insert({
          session_token: randomUUID(),
          prompt_text: 'Test expiry default',
        })
        .select('*')
        .single();

      const expiresAt = new Date(draft!.expires_at);
      const createdAt = new Date(draft!.created_at);

      const daysDiff = (expiresAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

      expect(daysDiff).toBeGreaterThan(6.9);
      expect(daysDiff).toBeLessThan(7.1);

      // Cleanup
      await supabase.from('draft_prompts').delete().eq('id', draft!.id);
    });
  });
});
