/**
 * GDP-012: Segment Engine Test
 *
 * Tests for evaluating segment membership and triggering automations
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

describe('GDP-012: Segment Engine', () => {
  let supabase: ReturnType<typeof createClient>;
  let testPersonId: string;
  let testSegmentId: string;

  beforeAll(() => {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
  });

  beforeEach(async () => {
    // Create a test person
    const { data: person, error: personError } = await supabase
      .from('person')
      .insert({
        email: 'test-segment@example.com',
        first_name: 'Test',
        last_name: 'User',
      })
      .select()
      .single();

    if (personError) throw personError;
    testPersonId = person.id;

    // Create person_features for the test person
    await supabase.from('person_features').insert({
      person_id: testPersonId,
      active_days: 5,
      core_actions: 3,
      pricing_views: 2,
      email_opens: 4,
      last_activity_at: new Date().toISOString(),
    });

    // Create a test segment
    const { data: segment, error: segmentError } = await supabase
      .from('segment')
      .insert({
        name: `test_segment_${Date.now()}`,
        description: 'Test segment for automated testing',
        conditions: {
          person_features: {
            active_days: '>3',
            core_actions: '>2',
          },
        },
        automation_config: {
          email_template: 'test_template',
          trigger: 'on_enter',
        },
        is_active: true,
      })
      .select()
      .single();

    if (segmentError) throw segmentError;
    testSegmentId = segment.id;
  });

  afterEach(async () => {
    // Clean up test data
    if (testSegmentId) {
      await supabase.from('segment').delete().eq('id', testSegmentId);
    }
    if (testPersonId) {
      await supabase.from('person_features').delete().eq('person_id', testPersonId);
      await supabase.from('event').delete().eq('person_id', testPersonId);
      await supabase.from('person').delete().eq('id', testPersonId);
    }
  });

  describe('Segment Membership Evaluation', () => {
    test('should evaluate person_features conditions', async () => {
      // This test will call the evaluate_segment_membership RPC function
      const { data, error } = await supabase.rpc('evaluate_segment_membership', {
        p_segment_id: testSegmentId,
        p_person_id: testPersonId,
      });

      expect(error).toBeNull();
      expect(data).toBe(true); // Person matches segment conditions
    });

    test('should return false when person does not match conditions', async () => {
      // Update person_features to not match
      await supabase
        .from('person_features')
        .update({ active_days: 1, core_actions: 1 })
        .eq('person_id', testPersonId);

      const { data, error } = await supabase.rpc('evaluate_segment_membership', {
        p_segment_id: testSegmentId,
        p_person_id: testPersonId,
      });

      expect(error).toBeNull();
      expect(data).toBe(false);
    });

    test('should evaluate event-based conditions', async () => {
      // Create a segment with event conditions
      const { data: eventSegment, error: segmentError } = await supabase
        .from('segment')
        .insert({
          name: `event_segment_${Date.now()}`,
          description: 'Event-based test segment',
          conditions: {
            event: 'video_generated',
            not_event: 'video_downloaded',
            time_window: '48h',
          },
          automation_config: {
            email_template: 'download_reminder',
          },
          is_active: true,
        })
        .select()
        .single();

      if (segmentError) throw segmentError;

      // Insert event
      await supabase.from('event').insert({
        person_id: testPersonId,
        event_name: 'video_generated',
        event_source: 'web',
        occurred_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 24h ago
      });

      const { data, error } = await supabase.rpc('evaluate_segment_membership', {
        p_segment_id: eventSegment.id,
        p_person_id: testPersonId,
      });

      // Cleanup
      await supabase.from('segment').delete().eq('id', eventSegment.id);

      expect(error).toBeNull();
      expect(data).toBe(true);
    });

    test('should evaluate event_count conditions', async () => {
      // Create a segment with event_count conditions
      const { data: countSegment, error: segmentError } = await supabase
        .from('segment')
        .insert({
          name: `count_segment_${Date.now()}`,
          description: 'Event count test segment',
          conditions: {
            event_count: {
              pricing_view: '>=2',
            },
          },
          automation_config: {
            email_template: 'pricing_followup',
          },
          is_active: true,
        })
        .select()
        .single();

      if (segmentError) throw segmentError;

      // Insert multiple pricing_view events
      await supabase.from('event').insert([
        {
          person_id: testPersonId,
          event_name: 'pricing_view',
          event_source: 'web',
          occurred_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        },
        {
          person_id: testPersonId,
          event_name: 'pricing_view',
          event_source: 'web',
          occurred_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        },
      ]);

      const { data, error } = await supabase.rpc('evaluate_segment_membership', {
        p_segment_id: countSegment.id,
        p_person_id: testPersonId,
      });

      // Cleanup
      await supabase.from('segment').delete().eq('id', countSegment.id);

      expect(error).toBeNull();
      expect(data).toBe(true);
    });
  });

  describe('Batch Segment Evaluation', () => {
    test('should evaluate all active segments for a person', async () => {
      const { data, error } = await supabase.rpc('evaluate_person_segments', {
        p_person_id: testPersonId,
      });

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty('segment_id');
      expect(data[0]).toHaveProperty('segment_name');
      expect(data[0]).toHaveProperty('matches');
    });

    test('should only evaluate active segments', async () => {
      // Deactivate the test segment
      await supabase.from('segment').update({ is_active: false }).eq('id', testSegmentId);

      const { data, error } = await supabase.rpc('evaluate_person_segments', {
        p_person_id: testPersonId,
      });

      expect(error).toBeNull();
      const matchingSegment = data?.find((s: any) => s.segment_id === testSegmentId);
      expect(matchingSegment).toBeUndefined();
    });
  });

  describe('Automation Triggers', () => {
    test('should trigger automation when person enters segment', async () => {
      const { data, error } = await supabase.rpc('trigger_segment_automation', {
        p_segment_id: testSegmentId,
        p_person_id: testPersonId,
      });

      expect(error).toBeNull();
      expect(data).toHaveProperty('automation_triggered');
      expect(data.automation_triggered).toBe(true);
      expect(data).toHaveProperty('actions');
    });

    test('should queue email automation', async () => {
      // Create segment with email automation
      const { data: emailSegment, error: segmentError } = await supabase
        .from('segment')
        .insert({
          name: `email_segment_${Date.now()}`,
          description: 'Email automation test',
          conditions: {
            person_features: {
              active_days: '>3',
            },
          },
          automation_config: {
            email_template: 'test_email',
            delay_hours: 0,
          },
          is_active: true,
        })
        .select()
        .single();

      if (segmentError) throw segmentError;

      const { data, error } = await supabase.rpc('trigger_segment_automation', {
        p_segment_id: emailSegment.id,
        p_person_id: testPersonId,
      });

      // Cleanup
      await supabase.from('segment').delete().eq('id', emailSegment.id);

      expect(error).toBeNull();
      expect(data.actions).toContain('email_queued');
    });

    test('should add person to Meta custom audience', async () => {
      // Create segment with Meta audience automation
      const { data: metaSegment, error: segmentError } = await supabase
        .from('segment')
        .insert({
          name: `meta_segment_${Date.now()}`,
          description: 'Meta audience test',
          conditions: {
            person_features: {
              pricing_views: '>=2',
            },
          },
          automation_config: {
            meta_audience: 'pricing_interested',
          },
          is_active: true,
        })
        .select()
        .single();

      if (segmentError) throw segmentError;

      const { data, error } = await supabase.rpc('trigger_segment_automation', {
        p_segment_id: metaSegment.id,
        p_person_id: testPersonId,
      });

      // Cleanup
      await supabase.from('segment').delete().eq('id', metaSegment.id);

      expect(error).toBeNull();
      expect(data.actions).toContain('meta_audience_added');
    });
  });

  describe('Segment Membership Table', () => {
    test('should track segment membership over time', async () => {
      // Insert segment membership record
      const { data, error } = await supabase
        .from('segment_membership')
        .insert({
          person_id: testPersonId,
          segment_id: testSegmentId,
          entered_at: new Date().toISOString(),
          is_active: true,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toHaveProperty('person_id', testPersonId);
      expect(data).toHaveProperty('segment_id', testSegmentId);
      expect(data.is_active).toBe(true);

      // Cleanup
      await supabase.from('segment_membership').delete().eq('id', data.id);
    });

    test('should exit person from segment when conditions no longer match', async () => {
      // First enter the segment
      const { data: membership, error: insertError } = await supabase
        .from('segment_membership')
        .insert({
          person_id: testPersonId,
          segment_id: testSegmentId,
          entered_at: new Date().toISOString(),
          is_active: true,
        })
        .select()
        .single();

      expect(insertError).toBeNull();

      // Update to exit the segment
      const { data, error } = await supabase
        .from('segment_membership')
        .update({
          is_active: false,
          exited_at: new Date().toISOString(),
        })
        .eq('id', membership.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.is_active).toBe(false);
      expect(data.exited_at).not.toBeNull();

      // Cleanup
      await supabase.from('segment_membership').delete().eq('id', membership.id);
    });
  });

  describe('Default CanvasCast Segments', () => {
    test('should have default segments installed', async () => {
      const { data, error } = await supabase.from('segment').select('name').in('name', [
        'signup_no_prompt_24h',
        'video_generated_no_download_48h',
        'low_credits_high_usage',
        'pricing_viewed_2plus_not_paid',
        'demo_watched_not_signed_up',
      ]);

      expect(error).toBeNull();
      expect(data?.length).toBe(5);
    });

    test('signup_no_prompt_24h segment should match qualifying users', async () => {
      // Create a user who signed up but has not submitted a prompt
      const { data: newPerson, error: personError } = await supabase
        .from('person')
        .insert({
          email: 'noprompt@example.com',
          first_name: 'No',
          last_name: 'Prompt',
        })
        .select()
        .single();

      if (personError) throw personError;

      // Add signup event 12 hours ago (within the 24h window)
      await supabase.from('event').insert({
        person_id: newPerson.id,
        event_name: 'signup_completed',
        event_source: 'web',
        occurred_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
      });

      const { data: segment, error: segmentError } = await supabase
        .from('segment')
        .select('id')
        .eq('name', 'signup_no_prompt_24h')
        .single();

      if (segmentError) throw segmentError;

      const { data, error } = await supabase.rpc('evaluate_segment_membership', {
        p_segment_id: segment.id,
        p_person_id: newPerson.id,
      });

      // Cleanup
      await supabase.from('event').delete().eq('person_id', newPerson.id);
      await supabase.from('person').delete().eq('id', newPerson.id);

      expect(error).toBeNull();
      expect(data).toBe(true);
    });
  });
});
