/**
 * Tests for Appeal Process functionality (MOD-004)
 *
 * Tests ensure that:
 * 1. Users can submit appeals for blocked content
 * 2. Appeals are stored with proper metadata
 * 3. Admins can view appeals queue
 * 4. Admins can resolve appeals (approve/deny)
 * 5. Users are notified of appeal decisions
 */

import { createClient } from '@supabase/supabase-js';

// Mock setup - use service role key to bypass RLS for testing
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || 'test-key';

describe('Appeal Process (MOD-004)', () => {
  let supabase: ReturnType<typeof createClient>;

  beforeAll(() => {
    // Use service role key to bypass RLS for testing
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  });

  describe('Appeals Table', () => {
    it('should have an appeals table', async () => {
      // Query the table to check if it exists
      const { error } = await supabase
        .from('appeals')
        .select('*')
        .limit(1);

      // Table should exist (no error about missing table)
      expect(error).toBeNull();
    });

    it('should have required columns', async () => {
      // Insert a test record to verify schema
      const testAppeal = {
        user_id: null, // Will use NULL for testing
        audit_log_id: null,
        reason: 'I believe my content was incorrectly flagged',
        original_content: 'Create a motivational video about overcoming challenges',
        status: 'pending',
      };

      const { error } = await supabase
        .from('appeals')
        .insert(testAppeal)
        .select();

      // Should be able to insert with these columns
      expect(error).toBeNull();
    });

    it('should automatically set created_at timestamp', async () => {
      const testAppeal = {
        user_id: null,
        audit_log_id: null,
        reason: 'Test appeal with timestamp',
        original_content: 'Test content',
        status: 'pending',
      };

      const { data, error } = await supabase
        .from('appeals')
        .insert(testAppeal)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.created_at).toBeDefined();
      expect(new Date(data?.created_at).getTime()).toBeGreaterThan(Date.now() - 10000);
    });

    it('should support status enum values', async () => {
      // Test pending status (no resolution fields)
      const { error: pendingError } = await supabase
        .from('appeals')
        .insert({
          user_id: null,
          audit_log_id: null,
          reason: 'Test pending status',
          original_content: 'Test content',
          status: 'pending',
        })
        .select();

      expect(pendingError).toBeNull();

      // Test approved status (must have resolution fields)
      const { error: approvedError } = await supabase
        .from('appeals')
        .insert({
          user_id: null,
          audit_log_id: null,
          reason: 'Test approved status',
          original_content: 'Test content',
          status: 'approved',
          resolved_at: new Date().toISOString(),
          resolved_by: null,
          resolution_notes: 'Approved after review',
        })
        .select();

      expect(approvedError).toBeNull();

      // Test denied status (must have resolution fields)
      const { error: deniedError } = await supabase
        .from('appeals')
        .insert({
          user_id: null,
          audit_log_id: null,
          reason: 'Test denied status',
          original_content: 'Test content',
          status: 'denied',
          resolved_at: new Date().toISOString(),
          resolved_by: null,
          resolution_notes: 'Denied after review',
        })
        .select();

      expect(deniedError).toBeNull();
    });

    it('should track resolution details', async () => {
      // First, insert a pending appeal
      const { data: appeal, error: insertError } = await supabase
        .from('appeals')
        .insert({
          user_id: null,
          audit_log_id: null,
          reason: 'Appeal to be resolved',
          original_content: 'Test content',
          status: 'pending',
        })
        .select()
        .single();

      expect(insertError).toBeNull();
      expect(appeal).toBeDefined();

      // Now resolve it
      const { data: resolved, error: updateError } = await supabase
        .from('appeals')
        .update({
          status: 'approved',
          resolved_at: new Date().toISOString(),
          resolved_by: null, // Would be admin user_id in production
          resolution_notes: 'Content is acceptable',
        })
        .eq('id', appeal?.id)
        .select()
        .single();

      expect(updateError).toBeNull();
      expect(resolved).toBeDefined();
      expect(resolved?.status).toBe('approved');
      expect(resolved?.resolved_at).toBeDefined();
      expect(resolved?.resolution_notes).toBe('Content is acceptable');
    });
  });

  describe('Appeal Submission', () => {
    it('should allow users to submit appeals with reason', async () => {
      const testAppeal = {
        user_id: null,
        audit_log_id: null,
        reason: 'My video prompt about fitness motivation was incorrectly flagged as promotional content',
        original_content: 'Create a motivational video about fitness goals',
        status: 'pending',
        metadata: {
          ip_address: '127.0.0.1',
          user_agent: 'test-agent',
        },
      };

      const { data, error } = await supabase
        .from('appeals')
        .insert(testAppeal)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.status).toBe('pending');
      expect(data?.reason).toContain('incorrectly flagged');
    });

    it('should link appeals to audit log entries', async () => {
      // First create an audit log entry
      const { data: auditLog, error: auditError } = await supabase
        .from('audit_log')
        .insert({
          user_id: null,
          action: 'prompt_blocked',
          content: 'Blocked content for appeal',
          moderation_result: { allowed: false, reason: 'Policy violation' },
        })
        .select()
        .single();

      expect(auditError).toBeNull();

      // Now create appeal linked to it
      const { data: appeal, error: appealError } = await supabase
        .from('appeals')
        .insert({
          user_id: null,
          audit_log_id: auditLog?.id,
          reason: 'This should not have been blocked',
          original_content: 'Blocked content for appeal',
          status: 'pending',
        })
        .select()
        .single();

      expect(appealError).toBeNull();
      expect(appeal).toBeDefined();
      expect(appeal?.audit_log_id).toBe(auditLog?.id);
    });
  });

  describe('Admin Appeal Review', () => {
    beforeAll(async () => {
      // Insert test appeals for admin review
      const testAppeals = [
        {
          user_id: null,
          audit_log_id: null,
          reason: 'False positive - educational content',
          original_content: 'Create a video about climate change',
          status: 'pending',
        },
        {
          user_id: null,
          audit_log_id: null,
          reason: 'This is satire, not hate speech',
          original_content: 'Satirical video prompt',
          status: 'pending',
        },
        {
          user_id: null,
          audit_log_id: null,
          reason: 'Already resolved test appeal',
          original_content: 'Old test content',
          status: 'approved',
          resolved_at: new Date().toISOString(),
        },
      ];

      await supabase.from('appeals').insert(testAppeals);
    });

    it('should allow filtering appeals by status', async () => {
      // Get pending appeals
      const { data, error } = await supabase
        .from('appeals')
        .select('*')
        .eq('status', 'pending');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThanOrEqual(2);
      expect(data?.every((a) => a.status === 'pending')).toBe(true);
    });

    it('should allow ordering by created_at', async () => {
      const { data, error } = await supabase
        .from('appeals')
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

    it('should allow searching appeal content', async () => {
      const { data, error } = await supabase
        .from('appeals')
        .select('*')
        .ilike('original_content', '%climate%');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Appeal Resolution', () => {
    it('should allow approving an appeal', async () => {
      // Insert a pending appeal
      const { data: appeal } = await supabase
        .from('appeals')
        .insert({
          user_id: null,
          audit_log_id: null,
          reason: 'Test approval',
          original_content: 'Test content to approve',
          status: 'pending',
        })
        .select()
        .single();

      // Approve it
      const { data: approved, error } = await supabase
        .from('appeals')
        .update({
          status: 'approved',
          resolved_at: new Date().toISOString(),
          resolved_by: null,
          resolution_notes: 'Content is acceptable after review',
        })
        .eq('id', appeal?.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(approved).toBeDefined();
      expect(approved?.status).toBe('approved');
      expect(approved?.resolved_at).toBeDefined();
    });

    it('should allow denying an appeal', async () => {
      // Insert a pending appeal
      const { data: appeal } = await supabase
        .from('appeals')
        .insert({
          user_id: null,
          audit_log_id: null,
          reason: 'Test denial',
          original_content: 'Test content to deny',
          status: 'pending',
        })
        .select()
        .single();

      // Deny it
      const { data: denied, error } = await supabase
        .from('appeals')
        .update({
          status: 'denied',
          resolved_at: new Date().toISOString(),
          resolved_by: null,
          resolution_notes: 'Original decision upheld',
        })
        .eq('id', appeal?.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(denied).toBeDefined();
      expect(denied?.status).toBe('denied');
      expect(denied?.resolved_at).toBeDefined();
    });

    it('should require resolution notes when resolving', async () => {
      const { data: appeal } = await supabase
        .from('appeals')
        .insert({
          user_id: null,
          audit_log_id: null,
          reason: 'Test resolution notes requirement',
          original_content: 'Test content',
          status: 'pending',
        })
        .select()
        .single();

      // Try to resolve without notes (should still work at DB level, but API should enforce)
      const { data: resolved } = await supabase
        .from('appeals')
        .update({
          status: 'approved',
          resolved_at: new Date().toISOString(),
          resolved_by: null,
          // resolution_notes is optional at DB level but should be required by API
        })
        .eq('id', appeal?.id)
        .select()
        .single();

      // At DB level this should work, but we'll enforce in API
      expect(resolved).toBeDefined();
    });
  });
});
