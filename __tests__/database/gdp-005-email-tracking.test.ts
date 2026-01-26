/**
 * GDP-005: Email Event Tracking
 *
 * Tests for tracking and analyzing email delivery, engagement, and bounce events.
 * This builds on GDP-004 (webhook capture) to provide analytics capabilities.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

describe('GDP-005: Email Event Tracking Analytics', () => {
  let supabase: ReturnType<typeof createClient>;
  let testPersonId: string;
  let testEmailIds: string[] = [];

  beforeAll(async () => {
    supabase = createClient(supabaseUrl, supabaseKey);

    // Create a test person for analytics
    const { data: person, error } = await supabase
      .from('person')
      .insert({
        email: 'analytics-test@example.com',
        first_name: 'Analytics',
        last_name: 'Test',
      })
      .select()
      .single();

    if (error) throw error;
    testPersonId = person.id;

    // Create test email messages with various events
    const baseTime = Date.now();
    const emails = [
      {
        resend_email_id: 'email-1-' + Date.now(),
        person_id: testPersonId,
        subject: 'Welcome Email',
        to_address: 'analytics-test@example.com',
        from_address: 'hello@canvascast.com',
        tags: [{ name: 'campaign', value: 'welcome' }],
        sent_at: new Date(baseTime - 3600000).toISOString(), // 1 hour ago
      },
      {
        resend_email_id: 'email-2-' + Date.now(),
        person_id: testPersonId,
        subject: 'Video Complete',
        to_address: 'analytics-test@example.com',
        from_address: 'hello@canvascast.com',
        tags: [{ name: 'campaign', value: 'notification' }],
        sent_at: new Date(baseTime - 1800000).toISOString(), // 30 min ago
      },
      {
        resend_email_id: 'email-3-' + Date.now(),
        person_id: testPersonId,
        subject: 'Upgrade Reminder',
        to_address: 'analytics-test@example.com',
        from_address: 'hello@canvascast.com',
        tags: [{ name: 'campaign', value: 'marketing' }],
        sent_at: new Date(baseTime - 900000).toISOString(), // 15 min ago
      },
    ];

    for (const email of emails) {
      const { data, error } = await supabase
        .from('email_message')
        .insert(email)
        .select()
        .single();

      if (error) throw error;
      testEmailIds.push(data.id);
    }

    // Add events to simulate email journey
    // Email 1: Sent 1hr ago → Delivered immediately → Opened 10min after delivery → Clicked 20min after delivery
    await supabase.from('email_event').insert([
      {
        email_message_id: testEmailIds[0],
        event_type: 'delivered',
        occurred_at: new Date(baseTime - 3590000).toISOString(), // 1 hour - 10 sec ago
      },
      {
        email_message_id: testEmailIds[0],
        event_type: 'opened',
        occurred_at: new Date(baseTime - 3000000).toISOString(), // 50 min ago (10 min after sent)
      },
      {
        email_message_id: testEmailIds[0],
        event_type: 'clicked',
        link_url: 'https://canvascast.com/app/new',
        occurred_at: new Date(baseTime - 2400000).toISOString(), // 40 min ago (20 min after sent)
      },
    ]);

    // Email 2: Sent 30min ago → Delivered → Opened 10min after
    await supabase.from('email_event').insert([
      {
        email_message_id: testEmailIds[1],
        event_type: 'delivered',
        occurred_at: new Date(baseTime - 1790000).toISOString(), // 30 min - 10 sec ago
      },
      {
        email_message_id: testEmailIds[1],
        event_type: 'opened',
        occurred_at: new Date(baseTime - 1200000).toISOString(), // 20 min ago (10 min after sent)
      },
    ]);

    // Email 3: Sent 15min ago → Delivered → Bounced
    await supabase.from('email_event').insert([
      {
        email_message_id: testEmailIds[2],
        event_type: 'delivered',
        occurred_at: new Date(baseTime - 890000).toISOString(), // 15 min - 10 sec ago
      },
      {
        email_message_id: testEmailIds[2],
        event_type: 'bounced',
        occurred_at: new Date(baseTime - 600000).toISOString(), // 10 min ago
      },
    ]);
  });

  afterAll(async () => {
    // Cleanup: delete in reverse order of dependencies
    for (const emailId of testEmailIds) {
      await supabase.from('email_event').delete().eq('email_message_id', emailId);
      await supabase.from('email_message').delete().eq('id', emailId);
    }
    await supabase.from('person').delete().eq('id', testPersonId);
  });

  describe('Email Delivery Metrics', () => {
    it('should track total emails sent per person', async () => {
      const { data, error } = await supabase.rpc('get_email_metrics_for_person', {
        p_person_id: testPersonId,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(1);
      expect(data[0].total_sent).toBe(3);
    });

    it('should calculate delivery rate', async () => {
      const { data, error } = await supabase.rpc('get_email_metrics_for_person', {
        p_person_id: testPersonId,
      });

      expect(error).toBeNull();
      expect(data[0].delivered_count).toBe(3);
      expect(Number(data[0].delivery_rate)).toBeCloseTo(100, 0); // 3/3 = 100%
    });

    it('should track bounced emails', async () => {
      const { data, error } = await supabase.rpc('get_email_metrics_for_person', {
        p_person_id: testPersonId,
      });

      expect(error).toBeNull();
      expect(data[0].bounced_count).toBe(1);
      expect(Number(data[0].bounce_rate)).toBeCloseTo(33.33, 1); // 1/3 = 33.33%
    });
  });

  describe('Email Engagement Metrics', () => {
    it('should track open rate', async () => {
      const { data, error } = await supabase.rpc('get_email_metrics_for_person', {
        p_person_id: testPersonId,
      });

      expect(error).toBeNull();
      expect(data[0].opened_count).toBe(2); // Emails 1 and 2
      expect(Number(data[0].open_rate)).toBeCloseTo(66.67, 1); // 2/3 = 66.67%
    });

    it('should track click rate', async () => {
      const { data, error } = await supabase.rpc('get_email_metrics_for_person', {
        p_person_id: testPersonId,
      });

      expect(error).toBeNull();
      expect(data[0].clicked_count).toBe(1); // Only email 1
      expect(Number(data[0].click_rate)).toBeCloseTo(33.33, 1); // 1/3 = 33.33%
    });

    it('should calculate click-to-open rate', async () => {
      const { data, error } = await supabase.rpc('get_email_metrics_for_person', {
        p_person_id: testPersonId,
      });

      expect(error).toBeNull();
      expect(Number(data[0].click_to_open_rate)).toBeCloseTo(50, 0); // 1/2 = 50%
    });
  });

  describe('Campaign-Level Analytics', () => {
    it('should aggregate metrics by campaign tag', async () => {
      const { data, error } = await supabase.rpc('get_email_campaign_metrics', {
        p_campaign_name: 'welcome',
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(1);
      expect(data[0].total_sent).toBe(1);
      expect(data[0].opened_count).toBe(1);
      expect(data[0].clicked_count).toBe(1);
    });

    it('should track most clicked links', async () => {
      const { data, error } = await supabase.rpc('get_top_clicked_links', {
        p_limit: 5,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('link_url');
        expect(data[0]).toHaveProperty('click_count');
        expect(data[0].link_url).toBe('https://canvascast.com/app/new');
      }
    });
  });

  describe('Time-Based Analytics', () => {
    it('should track email events in last 24 hours', async () => {
      const { data, error } = await supabase.rpc('get_recent_email_events', {
        p_hours: 24,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(7); // All our test events
    });

    it('should calculate average time to open', async () => {
      const { data, error } = await supabase.rpc('get_email_timing_metrics', {
        p_person_id: testPersonId,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(1);
      expect(Number(data[0].avg_time_to_open_minutes)).toBeGreaterThan(0);
    });
  });

  describe('Person-Level Engagement', () => {
    it('should identify active email recipients', async () => {
      const { data, error } = await supabase.rpc('get_active_email_users', {
        p_days: 7,
        p_min_opens: 1,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);

      // Our test person should be in the list
      const testPerson = data.find((p: any) => p.person_id === testPersonId);
      expect(testPerson).toBeDefined();
      expect(testPerson.total_opens).toBe(2);
    });

    it('should track email event timeline for person', async () => {
      const { data, error } = await supabase.rpc('get_person_email_timeline', {
        p_person_id: testPersonId,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(7); // All events for this person
    });
  });
});
