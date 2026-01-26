/**
 * GDP-004: Integration test for Resend Webhook Edge Function
 *
 * Tests database interactions for email tracking
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

describe('GDP-004: Resend Webhook Database Integration', () => {
  let supabase: ReturnType<typeof createClient>;

  beforeAll(() => {
    supabase = createClient(supabaseUrl, supabaseKey);
  });

  it('should have email_message table', async () => {
    const { data, error } = await supabase
      .from('email_message')
      .select('*')
      .limit(1);

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it('should have email_event table', async () => {
    const { data, error } = await supabase
      .from('email_event')
      .select('*')
      .limit(1);

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it('should create email_message with person_id', async () => {
    // First create a test person
    const { data: person, error: personError } = await supabase
      .from('person')
      .insert({
        email: 'webhook-test@example.com',
        first_name: 'Webhook',
        last_name: 'Test',
      })
      .select()
      .single();

    expect(personError).toBeNull();
    expect(person).toBeDefined();

    // Create email_message
    const { data: emailMessage, error: emailError } = await supabase
      .from('email_message')
      .insert({
        person_id: person!.id,
        resend_email_id: 'test-webhook-email-' + Date.now(),
        subject: 'Test Email',
        to_address: 'webhook-test@example.com',
        from_address: 'hello@canvascast.com',
        tags: [
          { name: 'person_id', value: person!.id },
          { name: 'template', value: 'test' },
        ],
      })
      .select()
      .single();

    expect(emailError).toBeNull();
    expect(emailMessage).toBeDefined();
    expect(emailMessage!.person_id).toBe(person!.id);

    // Cleanup
    await supabase.from('email_message').delete().eq('id', emailMessage!.id);
    await supabase.from('person').delete().eq('id', person!.id);
  });

  it('should create email_event linked to email_message', async () => {
    // Create a test email_message first
    const { data: emailMessage, error: emailError } = await supabase
      .from('email_message')
      .insert({
        resend_email_id: 'test-event-email-' + Date.now(),
        subject: 'Event Test',
        to_address: 'event-test@example.com',
        from_address: 'hello@canvascast.com',
      })
      .select()
      .single();

    expect(emailError).toBeNull();

    // Create email_event
    const { data: emailEvent, error: eventError } = await supabase
      .from('email_event')
      .insert({
        email_message_id: emailMessage!.id,
        event_type: 'opened',
        occurred_at: new Date().toISOString(),
      })
      .select()
      .single();

    expect(eventError).toBeNull();
    expect(emailEvent).toBeDefined();
    expect(emailEvent!.event_type).toBe('opened');
    expect(emailEvent!.email_message_id).toBe(emailMessage!.id);

    // Cleanup
    await supabase.from('email_event').delete().eq('id', emailEvent!.id);
    await supabase.from('email_message').delete().eq('id', emailMessage!.id);
  });

  it('should store click event with link_url', async () => {
    // Create a test email_message first
    const { data: emailMessage, error: emailError } = await supabase
      .from('email_message')
      .insert({
        resend_email_id: 'test-click-email-' + Date.now(),
        subject: 'Click Test',
        to_address: 'click-test@example.com',
        from_address: 'hello@canvascast.com',
      })
      .select()
      .single();

    expect(emailError).toBeNull();

    // Create click event
    const { data: clickEvent, error: clickError } = await supabase
      .from('email_event')
      .insert({
        email_message_id: emailMessage!.id,
        event_type: 'clicked',
        link_url: 'https://canvascast.com/app/new',
        user_agent: 'Mozilla/5.0',
        ip_address: '192.168.1.1',
        occurred_at: new Date().toISOString(),
      })
      .select()
      .single();

    expect(clickError).toBeNull();
    expect(clickEvent).toBeDefined();
    expect(clickEvent!.event_type).toBe('clicked');
    expect(clickEvent!.link_url).toBe('https://canvascast.com/app/new');

    // Cleanup
    await supabase.from('email_event').delete().eq('id', clickEvent!.id);
    await supabase.from('email_message').delete().eq('id', emailMessage!.id);
  });

  it('should upsert email_message by resend_email_id', async () => {
    const resendEmailId = 'test-upsert-' + Date.now();

    // First insert
    const { data: first, error: firstError } = await supabase
      .from('email_message')
      .upsert(
        {
          resend_email_id: resendEmailId,
          subject: 'First Subject',
          to_address: 'upsert-test@example.com',
          from_address: 'hello@canvascast.com',
        },
        { onConflict: 'resend_email_id' }
      )
      .select()
      .single();

    expect(firstError).toBeNull();
    expect(first!.subject).toBe('First Subject');

    // Second upsert with same resend_email_id
    const { data: second, error: secondError } = await supabase
      .from('email_message')
      .upsert(
        {
          resend_email_id: resendEmailId,
          subject: 'Updated Subject',
          to_address: 'upsert-test@example.com',
          from_address: 'hello@canvascast.com',
        },
        { onConflict: 'resend_email_id' }
      )
      .select()
      .single();

    expect(secondError).toBeNull();
    expect(second!.id).toBe(first!.id); // Same record
    expect(second!.subject).toBe('Updated Subject');

    // Cleanup
    await supabase.from('email_message').delete().eq('id', first!.id);
  });
});
