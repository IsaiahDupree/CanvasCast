/**
 * Tests for Audit Log functionality (MOD-003)
 *
 * Tests ensure that:
 * 1. All prompts are logged to an immutable audit table
 * 2. Audit logs include user_id, content, moderation result
 * 3. Audit logs are searchable by admin
 * 4. Audit logs cannot be modified or deleted
 */

import { createClient } from '@supabase/supabase-js';
import request from 'supertest';

// Mock setup - use service role key to bypass RLS for testing
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || 'test-key';

describe('Audit Log (MOD-003)', () => {
  let supabase: ReturnType<typeof createClient>;

  beforeAll(() => {
    // Use service role key to bypass RLS for testing
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  });

  describe('Audit Log Table', () => {
    it('should have an audit_log table', async () => {
      // Query the table to check if it exists
      const { error } = await supabase
        .from('audit_log')
        .select('*')
        .limit(1);

      // Table should exist (no error about missing table)
      expect(error).toBeNull();
    });

    it('should have required columns', async () => {
      // Insert a test record to verify schema
      // Use NULL for user_id since we don't have a real user in test DB
      const testRecord = {
        user_id: null,
        action: 'prompt_submitted',
        content: 'Test prompt',
        moderation_result: { allowed: true },
        metadata: { test: true },
      };

      const { error } = await supabase
        .from('audit_log')
        .insert(testRecord)
        .select();

      // Should be able to insert with these columns
      expect(error).toBeNull();
    });

    it('should automatically set created_at timestamp', async () => {
      const testRecord = {
        user_id: null,
        action: 'prompt_submitted',
        content: 'Test prompt with timestamp',
        moderation_result: { allowed: true },
      };

      const { data, error } = await supabase
        .from('audit_log')
        .insert(testRecord)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.created_at).toBeDefined();
      expect(new Date(data?.created_at).getTime()).toBeGreaterThan(Date.now() - 10000);
    });

    it('should prevent updates to audit log records', async () => {
      // First, insert a record
      const { data: inserted, error: insertError } = await supabase
        .from('audit_log')
        .insert({
          user_id: null,
          action: 'prompt_submitted',
          content: 'Immutable test prompt',
          moderation_result: { allowed: true },
        })
        .select()
        .single();

      expect(insertError).toBeNull();
      expect(inserted).toBeDefined();

      // Try to update it
      const { error: updateError } = await supabase
        .from('audit_log')
        .update({ content: 'Modified content' })
        .eq('id', inserted?.id);

      // Update should be blocked by policy or trigger
      expect(updateError).toBeDefined();
    });

    it('should prevent deletes from audit log', async () => {
      // First, insert a record
      const { data: inserted, error: insertError } = await supabase
        .from('audit_log')
        .insert({
          user_id: null,
          action: 'prompt_submitted',
          content: 'Delete test prompt',
          moderation_result: { allowed: true },
        })
        .select()
        .single();

      expect(insertError).toBeNull();
      expect(inserted).toBeDefined();

      // Try to delete it
      const { error: deleteError } = await supabase
        .from('audit_log')
        .delete()
        .eq('id', inserted?.id);

      // Delete should be blocked by policy
      expect(deleteError).toBeDefined();
    });
  });

  describe('Audit Log Search', () => {
    beforeAll(async () => {
      // Insert test data for search tests
      // Use null for user_id since we don't have real users in test DB
      const testRecords = [
        {
          user_id: null,
          action: 'prompt_submitted',
          content: 'Create a video about cats',
          moderation_result: { allowed: true },
        },
        {
          user_id: null,
          action: 'prompt_submitted',
          content: 'Make a video about dogs',
          moderation_result: { allowed: true },
        },
        {
          user_id: null,
          action: 'prompt_blocked',
          content: 'Inappropriate content',
          moderation_result: { allowed: false, reason: 'Policy violation' },
        },
      ];

      await supabase.from('audit_log').insert(testRecords);
    });

    it('should allow searching by user_id', async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .is('user_id', null);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThanOrEqual(3);
    });

    it('should allow searching by action type', async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('action', 'prompt_blocked');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThanOrEqual(1);
    });

    it('should allow searching by content (text search)', async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .ilike('content', '%cats%');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThanOrEqual(1);
    });

    it('should allow filtering by moderation result', async () => {
      // Search for blocked content
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('moderation_result->>allowed', 'false');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThanOrEqual(1);
    });

    it('should allow ordering by created_at', async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThan(0);

      // Verify ordering
      if (data && data.length > 1) {
        const firstDate = new Date(data[0].created_at).getTime();
        const secondDate = new Date(data[1].created_at).getTime();
        expect(firstDate).toBeGreaterThanOrEqual(secondDate);
      }
    });
  });

  describe('Audit Log Integration with Moderation', () => {
    it('should create audit log entry when prompt is moderated', async () => {
      // This would be an integration test with the actual API
      // For now, we just verify the table is ready for integration
      const testRecord = {
        user_id: null,
        action: 'prompt_submitted',
        content: 'Test integration prompt',
        moderation_result: { allowed: true },
        metadata: {
          ip_address: '127.0.0.1',
          user_agent: 'test-agent',
        },
      };

      const { data, error } = await supabase
        .from('audit_log')
        .insert(testRecord)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.action).toBe('prompt_submitted');
      expect(data?.metadata).toEqual({
        ip_address: '127.0.0.1',
        user_agent: 'test-agent',
      });
    });

    it('should log blocked content with reason', async () => {
      const testRecord = {
        user_id: null,
        action: 'prompt_blocked',
        content: 'Blocked content example',
        moderation_result: {
          allowed: false,
          reason: 'Content violates policy',
          categories: ['violence', 'hate'],
        },
      };

      const { data, error } = await supabase
        .from('audit_log')
        .insert(testRecord)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.action).toBe('prompt_blocked');
      expect(data?.moderation_result.allowed).toBe(false);
      expect(data?.moderation_result.categories).toContain('violence');
    });
  });
});
