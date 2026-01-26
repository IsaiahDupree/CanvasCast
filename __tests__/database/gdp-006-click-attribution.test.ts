/**
 * GDP-006: Click Attribution Schema Tests
 *
 * Tests for the click_attribution table and related functions
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

let supabase: SupabaseClient;

describe('GDP-006: Click Attribution Database Schema', () => {
  beforeAll(() => {
    supabase = createClient(supabaseUrl, supabaseKey);
  });

  afterAll(() => {
    // Cleanup
  });

  describe('click_attribution table', () => {
    it('should have required columns', async () => {
      const { data, error } = await supabase.rpc('get_table_columns', {
        table_name: 'click_attribution',
      });

      expect(error).toBeNull();
      expect(data).toBeTruthy();

      const columnNames = data?.map((col: any) => col.column_name) || [];

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('email_message_id');
      expect(columnNames).toContain('click_token');
      expect(columnNames).toContain('link_url');
      expect(columnNames).toContain('user_agent');
      expect(columnNames).toContain('ip_address');
      expect(columnNames).toContain('clicked_at');
      expect(columnNames).toContain('created_at');
    });

    it('should allow inserting click attribution record', async () => {
      // First create a person and email_message for FK constraint
      const { data: person } = await supabase
        .from('person')
        .insert({ email: 'test@example.com' })
        .select()
        .single();

      expect(person).toBeTruthy();

      const { data: emailMessage } = await supabase
        .from('email_message')
        .insert({
          person_id: person.id,
          to_address: 'test@example.com',
          from_address: 'noreply@canvascast.com',
          subject: 'Test Email',
        })
        .select()
        .single();

      expect(emailMessage).toBeTruthy();

      // Now insert click attribution
      const { data: clickAttr, error } = await supabase
        .from('click_attribution')
        .insert({
          email_message_id: emailMessage.id,
          click_token: 'test_token_' + Date.now(),
          link_url: 'https://example.com/pricing',
          user_agent: 'Mozilla/5.0',
          ip_address: '192.168.1.1',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(clickAttr).toBeTruthy();
      expect(clickAttr?.click_token).toBeTruthy();
      expect(clickAttr?.link_url).toBe('https://example.com/pricing');

      // Cleanup
      await supabase.from('click_attribution').delete().eq('id', clickAttr.id);
      await supabase.from('email_message').delete().eq('id', emailMessage.id);
      await supabase.from('person').delete().eq('id', person.id);
    });

    it('should enforce unique click_token constraint', async () => {
      const { data: person } = await supabase
        .from('person')
        .insert({ email: 'test2@example.com' })
        .select()
        .single();

      const { data: emailMessage } = await supabase
        .from('email_message')
        .insert({
          person_id: person.id,
          to_address: 'test2@example.com',
          from_address: 'noreply@canvascast.com',
          subject: 'Test Email',
        })
        .select()
        .single();

      const uniqueToken = 'unique_token_' + Date.now();

      // Insert first record
      const { data: first } = await supabase
        .from('click_attribution')
        .insert({
          email_message_id: emailMessage.id,
          click_token: uniqueToken,
          link_url: 'https://example.com/pricing',
        })
        .select()
        .single();

      expect(first).toBeTruthy();

      // Try to insert duplicate token
      const { data: second, error: duplicateError } = await supabase
        .from('click_attribution')
        .insert({
          email_message_id: emailMessage.id,
          click_token: uniqueToken,
          link_url: 'https://example.com/other',
        })
        .select()
        .single();

      expect(duplicateError).toBeTruthy();
      expect(duplicateError?.message).toContain('duplicate');

      // Cleanup
      await supabase.from('click_attribution').delete().eq('id', first.id);
      await supabase.from('email_message').delete().eq('id', emailMessage.id);
      await supabase.from('person').delete().eq('id', person.id);
    });
  });

  describe('generate_tracking_url function', () => {
    it('should generate tracking URL with email_id and target', async () => {
      const emailMessageId = '123e4567-e89b-12d3-a456-426614174000';
      const targetUrl = 'https://example.com/pricing';

      const { data, error } = await supabase.rpc('generate_tracking_url', {
        p_email_message_id: emailMessageId,
        p_target_url: targetUrl,
      });

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data).toContain('/click?email_id=');
      expect(data).toContain(emailMessageId);
      expect(data).toContain('&target=');
    });

    it('should URL encode target parameter', async () => {
      const emailMessageId = '123e4567-e89b-12d3-a456-426614174000';
      const targetUrl = 'https://example.com/page?foo=bar&baz=qux';

      const { data, error } = await supabase.rpc('generate_tracking_url', {
        p_email_message_id: emailMessageId,
        p_target_url: targetUrl,
      });

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      // Should contain encoded characters
      expect(data).toContain('%');
    });

    it('should use custom base URL if provided', async () => {
      const emailMessageId = '123e4567-e89b-12d3-a456-426614174000';
      const targetUrl = 'https://example.com/pricing';
      const baseUrl = 'https://custom.domain.com';

      const { data, error } = await supabase.rpc('generate_tracking_url', {
        p_email_message_id: emailMessageId,
        p_target_url: targetUrl,
        p_base_url: baseUrl,
      });

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data).toContain(baseUrl);
    });
  });

  describe('get_click_attribution_by_token function', () => {
    it('should retrieve click attribution by token', async () => {
      // Setup
      const { data: person } = await supabase
        .from('person')
        .insert({ email: 'test3@example.com' })
        .select()
        .single();

      const { data: emailMessage } = await supabase
        .from('email_message')
        .insert({
          person_id: person.id,
          to_address: 'test3@example.com',
          from_address: 'noreply@canvascast.com',
          subject: 'Test Email',
        })
        .select()
        .single();

      const testToken = 'lookup_token_' + Date.now();

      const { data: clickAttr } = await supabase
        .from('click_attribution')
        .insert({
          email_message_id: emailMessage.id,
          click_token: testToken,
          link_url: 'https://example.com/pricing',
        })
        .select()
        .single();

      // Test function
      const { data, error } = await supabase.rpc(
        'get_click_attribution_by_token',
        {
          p_click_token: testToken,
        }
      );

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data.length).toBe(1);
      expect(data[0].click_token).toBe(testToken);
      expect(data[0].person_id).toBe(person.id);
      expect(data[0].link_url).toBe('https://example.com/pricing');

      // Cleanup
      await supabase.from('click_attribution').delete().eq('id', clickAttr.id);
      await supabase.from('email_message').delete().eq('id', emailMessage.id);
      await supabase.from('person').delete().eq('id', person.id);
    });

    it('should return empty array for non-existent token', async () => {
      const { data, error } = await supabase.rpc(
        'get_click_attribution_by_token',
        {
          p_click_token: 'nonexistent_token',
        }
      );

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data.length).toBe(0);
    });
  });
});
