/**
 * GDP-011: Person Features Computation Test
 *
 * Tests the computation of person features from events:
 * - active_days: Number of unique days the person was active
 * - core_actions: Count of core value actions (video_generated, video_downloaded, etc.)
 * - pricing_views: Count of pricing page views
 * - email_opens: Count of email open events
 * - last_activity_at: Most recent event timestamp
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

describe('GDP-011: Person Features Computation', () => {
  let testPersonId: string;
  let testEvents: any[] = [];

  beforeAll(async () => {
    // Create a test person
    const { data: person, error } = await supabase
      .from('person')
      .insert({
        email: 'test-features@example.com',
        first_name: 'Test',
        last_name: 'User',
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(person).toBeDefined();
    testPersonId = person!.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testPersonId) {
      await supabase.from('person').delete().eq('id', testPersonId);
    }
  });

  beforeEach(async () => {
    // Clear events and features before each test
    await supabase.from('event').delete().eq('person_id', testPersonId);
    // Clean up email events through email_message cascade
    await supabase.from('email_message').delete().eq('person_id', testPersonId);
    await supabase.from('person_features').delete().eq('person_id', testPersonId);
  });

  describe('Active Days Computation', () => {
    it('should compute active_days from unique event days', async () => {
      // Insert events on 3 different days
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);

      await supabase.from('event').insert([
        {
          person_id: testPersonId,
          event_name: 'landing_view',
          event_source: 'web',
          occurred_at: twoDaysAgo.toISOString(),
        },
        {
          person_id: testPersonId,
          event_name: 'signup_completed',
          event_source: 'web',
          occurred_at: twoDaysAgo.toISOString(), // Same day
        },
        {
          person_id: testPersonId,
          event_name: 'video_generated',
          event_source: 'app',
          occurred_at: yesterday.toISOString(),
        },
        {
          person_id: testPersonId,
          event_name: 'video_downloaded',
          event_source: 'app',
          occurred_at: today.toISOString(),
        },
      ]);

      // Compute features
      const { error: computeError } = await supabase.rpc('compute_person_features', {
        target_person_id: testPersonId,
      });

      expect(computeError).toBeNull();

      // Verify active_days = 3
      const { data: features } = await supabase
        .from('person_features')
        .select('*')
        .eq('person_id', testPersonId)
        .single();

      expect(features).toBeDefined();
      expect(features!.active_days).toBe(3);
    });

    it('should handle multiple events on the same day', async () => {
      const today = new Date();

      await supabase.from('event').insert([
        {
          person_id: testPersonId,
          event_name: 'landing_view',
          event_source: 'web',
          occurred_at: today.toISOString(),
        },
        {
          person_id: testPersonId,
          event_name: 'signup_completed',
          event_source: 'web',
          occurred_at: today.toISOString(),
        },
        {
          person_id: testPersonId,
          event_name: 'video_generated',
          event_source: 'app',
          occurred_at: today.toISOString(),
        },
      ]);

      const { error } = await supabase.rpc('compute_person_features', {
        target_person_id: testPersonId,
      });

      expect(error).toBeNull();

      const { data: features } = await supabase
        .from('person_features')
        .select('active_days')
        .eq('person_id', testPersonId)
        .single();

      expect(features!.active_days).toBe(1);
    });
  });

  describe('Core Actions Computation', () => {
    it('should count core value actions', async () => {
      // Core actions for CanvasCast: video_generated, video_downloaded, prompt_submitted
      await supabase.from('event').insert([
        { person_id: testPersonId, event_name: 'video_generated', event_source: 'app' },
        { person_id: testPersonId, event_name: 'video_generated', event_source: 'app' },
        { person_id: testPersonId, event_name: 'video_downloaded', event_source: 'app' },
        { person_id: testPersonId, event_name: 'prompt_submitted', event_source: 'app' },
        { person_id: testPersonId, event_name: 'landing_view', event_source: 'web' }, // Not a core action
      ]);

      const { error } = await supabase.rpc('compute_person_features', {
        target_person_id: testPersonId,
      });

      expect(error).toBeNull();

      const { data: features } = await supabase
        .from('person_features')
        .select('core_actions')
        .eq('person_id', testPersonId)
        .single();

      expect(features!.core_actions).toBe(4);
    });

    it('should handle zero core actions', async () => {
      await supabase.from('event').insert([
        { person_id: testPersonId, event_name: 'landing_view', event_source: 'web' },
        { person_id: testPersonId, event_name: 'pricing_view', event_source: 'web' },
      ]);

      const { error } = await supabase.rpc('compute_person_features', {
        target_person_id: testPersonId,
      });

      expect(error).toBeNull();

      const { data: features } = await supabase
        .from('person_features')
        .select('core_actions')
        .eq('person_id', testPersonId)
        .single();

      expect(features!.core_actions).toBe(0);
    });
  });

  describe('Pricing Views Computation', () => {
    it('should count pricing_view events', async () => {
      await supabase.from('event').insert([
        { person_id: testPersonId, event_name: 'pricing_view', event_source: 'web' },
        { person_id: testPersonId, event_name: 'pricing_view', event_source: 'web' },
        { person_id: testPersonId, event_name: 'pricing_view', event_source: 'web' },
        { person_id: testPersonId, event_name: 'landing_view', event_source: 'web' },
      ]);

      const { error } = await supabase.rpc('compute_person_features', {
        target_person_id: testPersonId,
      });

      expect(error).toBeNull();

      const { data: features } = await supabase
        .from('person_features')
        .select('pricing_views')
        .eq('person_id', testPersonId)
        .single();

      expect(features!.pricing_views).toBe(3);
    });
  });

  describe('Email Opens Computation', () => {
    it('should count email open events from email_event table', async () => {
      // First create email messages
      const { data: messages } = await supabase
        .from('email_message')
        .insert([
          {
            person_id: testPersonId,
            resend_email_id: 'msg_1',
            to_address: 'test@example.com',
            from_address: 'noreply@canvascast.com',
            subject: 'Welcome',
          },
          {
            person_id: testPersonId,
            resend_email_id: 'msg_2',
            to_address: 'test@example.com',
            from_address: 'noreply@canvascast.com',
            subject: 'Your video is ready',
          },
        ])
        .select();

      expect(messages).toHaveLength(2);

      // Insert email open events
      // Note: email_event doesn't have person_id - it's linked through email_message
      await supabase.from('email_event').insert([
        {
          email_message_id: messages![0].id,
          event_type: 'opened',
        },
        {
          email_message_id: messages![1].id,
          event_type: 'opened',
        },
        {
          email_message_id: messages![1].id,
          event_type: 'clicked',
        },
      ]);

      const { error } = await supabase.rpc('compute_person_features', {
        target_person_id: testPersonId,
      });

      expect(error).toBeNull();

      const { data: features } = await supabase
        .from('person_features')
        .select('email_opens')
        .eq('person_id', testPersonId)
        .single();

      expect(features!.email_opens).toBe(2);
    });
  });

  describe('Last Activity Computation', () => {
    it('should set last_activity_at to the most recent event', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      await supabase.from('event').insert([
        {
          person_id: testPersonId,
          event_name: 'signup_completed',
          event_source: 'web',
          occurred_at: twoDaysAgo.toISOString(),
        },
        {
          person_id: testPersonId,
          event_name: 'video_generated',
          event_source: 'app',
          occurred_at: oneHourAgo.toISOString(),
        },
        {
          person_id: testPersonId,
          event_name: 'landing_view',
          event_source: 'web',
          occurred_at: now.toISOString(), // Most recent
        },
      ]);

      const { error } = await supabase.rpc('compute_person_features', {
        target_person_id: testPersonId,
      });

      expect(error).toBeNull();

      const { data: features } = await supabase
        .from('person_features')
        .select('last_activity_at')
        .eq('person_id', testPersonId)
        .single();

      expect(features!.last_activity_at).toBeDefined();

      const lastActivity = new Date(features!.last_activity_at);
      const timeDiff = Math.abs(lastActivity.getTime() - now.getTime());

      // Should be within 5 seconds
      expect(timeDiff).toBeLessThan(5000);
    });
  });

  describe('Feature Updates', () => {
    it('should update existing features instead of creating duplicates', async () => {
      // First computation
      await supabase.from('event').insert([
        { person_id: testPersonId, event_name: 'video_generated', event_source: 'app' },
      ]);

      await supabase.rpc('compute_person_features', {
        target_person_id: testPersonId,
      });

      const { data: initialFeatures } = await supabase
        .from('person_features')
        .select('*')
        .eq('person_id', testPersonId);

      expect(initialFeatures).toHaveLength(1);

      // Add more events and recompute
      await supabase.from('event').insert([
        { person_id: testPersonId, event_name: 'video_downloaded', event_source: 'app' },
      ]);

      await supabase.rpc('compute_person_features', {
        target_person_id: testPersonId,
      });

      const { data: updatedFeatures } = await supabase
        .from('person_features')
        .select('*')
        .eq('person_id', testPersonId);

      // Should still be only 1 record (updated, not duplicated)
      expect(updatedFeatures).toHaveLength(1);
      expect(updatedFeatures![0].core_actions).toBe(2);
    });

    it('should update computed_at timestamp on recomputation', async () => {
      await supabase.from('event').insert([
        { person_id: testPersonId, event_name: 'landing_view', event_source: 'web' },
      ]);

      // First computation
      await supabase.rpc('compute_person_features', {
        target_person_id: testPersonId,
      });

      const { data: initial } = await supabase
        .from('person_features')
        .select('computed_at')
        .eq('person_id', testPersonId)
        .single();

      const initialTime = new Date(initial!.computed_at).getTime();

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 100));

      // Recompute
      await supabase.rpc('compute_person_features', {
        target_person_id: testPersonId,
      });

      const { data: updated } = await supabase
        .from('person_features')
        .select('computed_at')
        .eq('person_id', testPersonId)
        .single();

      const updatedTime = new Date(updated!.computed_at).getTime();

      expect(updatedTime).toBeGreaterThan(initialTime);
    });
  });

  describe('Edge Cases', () => {
    it('should handle person with no events', async () => {
      const { error } = await supabase.rpc('compute_person_features', {
        target_person_id: testPersonId,
      });

      expect(error).toBeNull();

      const { data: features } = await supabase
        .from('person_features')
        .select('*')
        .eq('person_id', testPersonId)
        .single();

      expect(features).toBeDefined();
      expect(features!.active_days).toBe(0);
      expect(features!.core_actions).toBe(0);
      expect(features!.pricing_views).toBe(0);
      expect(features!.email_opens).toBe(0);
      expect(features!.last_activity_at).toBeNull();
    });

    it('should handle invalid person_id gracefully', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const { error } = await supabase.rpc('compute_person_features', {
        target_person_id: fakeId,
      });

      // Should not error - function will skip computation for non-existent person
      expect(error).toBeNull();

      // Verify no features were created
      const { data: features } = await supabase
        .from('person_features')
        .select('*')
        .eq('person_id', fakeId);

      expect(features).toHaveLength(0);
    });
  });

  describe('Batch Computation', () => {
    it('should support computing features for all persons', async () => {
      // This function should exist to recompute all features
      const { error } = await supabase.rpc('compute_all_person_features');

      // Should not error (even if no persons exist)
      expect(error).toBeNull();
    });
  });
});
