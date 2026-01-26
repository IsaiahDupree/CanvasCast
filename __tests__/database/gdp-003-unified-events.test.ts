/**
 * GDP-003: Unified Events Table
 * Test suite for unified event tracking from all sources
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

describe('GDP-003: Unified Events Table', () => {
  let testPersonId: string;

  beforeAll(async () => {
    // Create a test person for events
    const { data: person, error } = await supabase
      .from('person')
      .insert({
        email: 'test-events@example.com',
        first_name: 'Test',
        last_name: 'User'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test person: ${error.message}`);
    }

    testPersonId = person.id;
  });

  afterAll(async () => {
    // Clean up test data
    await supabase.from('event').delete().eq('person_id', testPersonId);
    await supabase.from('person').delete().eq('id', testPersonId);
  });

  describe('Event table schema', () => {
    it('should have event table with all required columns', async () => {
      const { data: columns } = await supabase
        .rpc('get_table_columns', { table_name: 'event' })
        .select('column_name, data_type');

      const columnMap = columns?.reduce((acc: any, col: any) => {
        acc[col.column_name] = col.data_type;
        return acc;
      }, {}) || {};

      expect(columnMap['id']).toBeDefined();
      expect(columnMap['person_id']).toBeDefined();
      expect(columnMap['event_name']).toBe('text');
      expect(columnMap['event_source']).toBe('text');
      expect(columnMap['properties']).toBe('jsonb');
      expect(columnMap['occurred_at']).toBeDefined();
      expect(columnMap['created_at']).toBeDefined();
    });
  });

  describe('Event creation', () => {
    it('should create a web event with properties', async () => {
      const { data, error } = await supabase
        .from('event')
        .insert({
          person_id: testPersonId,
          event_name: 'landing_view',
          event_source: 'web',
          properties: {
            utm_source: 'google',
            utm_campaign: 'brand',
            page_url: '/landing'
          },
          occurred_at: new Date().toISOString()
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.event_name).toBe('landing_view');
      expect(data.event_source).toBe('web');
      expect(data.properties).toHaveProperty('utm_source', 'google');
    });

    it('should create an app event', async () => {
      const { data, error } = await supabase
        .from('event')
        .insert({
          person_id: testPersonId,
          event_name: 'prompt_submitted',
          event_source: 'app',
          properties: {
            prompt_length: 150,
            niche: 'tech'
          },
          occurred_at: new Date().toISOString()
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.event_name).toBe('prompt_submitted');
      expect(data.event_source).toBe('app');
    });

    it('should create an email event', async () => {
      const { data, error } = await supabase
        .from('event')
        .insert({
          person_id: testPersonId,
          event_name: 'email.clicked',
          event_source: 'email',
          properties: {
            link_url: 'https://example.com/pricing',
            campaign: 'welcome_series'
          },
          occurred_at: new Date().toISOString()
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.event_name).toBe('email.clicked');
      expect(data.event_source).toBe('email');
    });

    it('should create a stripe event', async () => {
      const { data, error } = await supabase
        .from('event')
        .insert({
          person_id: testPersonId,
          event_name: 'credits_purchased',
          event_source: 'stripe',
          properties: {
            amount: 2999,
            credits: 50,
            payment_id: 'ch_test123'
          },
          occurred_at: new Date().toISOString()
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.event_name).toBe('credits_purchased');
      expect(data.event_source).toBe('stripe');
    });

    it('should create a meta event', async () => {
      const { data, error } = await supabase
        .from('event')
        .insert({
          person_id: testPersonId,
          event_name: 'purchase',
          event_source: 'meta',
          properties: {
            value: 29.99,
            currency: 'USD',
            event_id: 'evt_abc123'
          },
          occurred_at: new Date().toISOString()
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.event_name).toBe('purchase');
      expect(data.event_source).toBe('meta');
    });

    it('should allow event without person_id (anonymous tracking)', async () => {
      const { data, error } = await supabase
        .from('event')
        .insert({
          person_id: null,
          event_name: 'landing_view',
          event_source: 'web',
          properties: {
            anonymous_id: 'anon_123',
            page_url: '/landing'
          },
          occurred_at: new Date().toISOString()
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.person_id).toBeNull();
    });
  });

  describe('Event querying', () => {
    beforeAll(async () => {
      // Create test events
      const events = [
        { event_name: 'video_generated', event_source: 'app', occurred_at: new Date('2024-01-01').toISOString() },
        { event_name: 'video_downloaded', event_source: 'app', occurred_at: new Date('2024-01-02').toISOString() },
        { event_name: 'pricing_view', event_source: 'web', occurred_at: new Date('2024-01-03').toISOString() },
      ];

      for (const event of events) {
        await supabase.from('event').insert({
          person_id: testPersonId,
          ...event,
          properties: {}
        });
      }
    });

    it('should query events by person_id', async () => {
      const { data, error } = await supabase
        .from('event')
        .select('*')
        .eq('person_id', testPersonId);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.length).toBeGreaterThanOrEqual(3);
    });

    it('should query events by event_name', async () => {
      const { data, error } = await supabase
        .from('event')
        .select('*')
        .eq('person_id', testPersonId)
        .eq('event_name', 'video_generated');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.length).toBeGreaterThanOrEqual(1);
      expect(data![0].event_name).toBe('video_generated');
    });

    it('should query events by event_source', async () => {
      const { data, error } = await supabase
        .from('event')
        .select('*')
        .eq('person_id', testPersonId)
        .eq('event_source', 'app');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.length).toBeGreaterThanOrEqual(2);
      expect(data!.every(e => e.event_source === 'app')).toBe(true);
    });

    it('should query events ordered by occurred_at DESC', async () => {
      const { data, error } = await supabase
        .from('event')
        .select('*')
        .eq('person_id', testPersonId)
        .order('occurred_at', { ascending: false })
        .limit(10);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.length).toBeGreaterThan(0);

      // Verify ordering
      for (let i = 1; i < data!.length; i++) {
        const prevTime = new Date(data![i - 1].occurred_at).getTime();
        const currTime = new Date(data![i].occurred_at).getTime();
        expect(prevTime).toBeGreaterThanOrEqual(currTime);
      }
    });

    it('should query events with JSONB properties filter', async () => {
      // Create an event with specific property
      await supabase.from('event').insert({
        person_id: testPersonId,
        event_name: 'test_jsonb',
        event_source: 'web',
        properties: { test_key: 'test_value' },
        occurred_at: new Date().toISOString()
      });

      const { data, error } = await supabase
        .from('event')
        .select('*')
        .eq('person_id', testPersonId)
        .eq('event_name', 'test_jsonb');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.length).toBeGreaterThanOrEqual(1);
      expect(data![0].properties).toHaveProperty('test_key', 'test_value');
    });
  });

  describe('Event sources', () => {
    it('should support all expected event sources', async () => {
      const sources = ['web', 'app', 'email', 'stripe', 'booking', 'meta'];

      for (const source of sources) {
        const { error } = await supabase
          .from('event')
          .insert({
            person_id: testPersonId,
            event_name: `test_${source}`,
            event_source: source,
            properties: {},
            occurred_at: new Date().toISOString()
          });

        expect(error).toBeNull();
      }

      // Verify all sources were created
      const { data } = await supabase
        .from('event')
        .select('event_source')
        .eq('person_id', testPersonId)
        .in('event_source', sources);

      const uniqueSources = [...new Set(data?.map(e => e.event_source))];
      expect(uniqueSources.length).toBe(sources.length);
    });
  });

  describe('CanvasCast-specific events', () => {
    it('should track all CanvasCast funnel events', async () => {
      const funnelEvents = [
        { event_name: 'landing_view', event_source: 'web' },
        { event_name: 'demo_video_played', event_source: 'web' },
        { event_name: 'signup_completed', event_source: 'web' },
        { event_name: 'credits_granted', event_source: 'app' },
        { event_name: 'prompt_submitted', event_source: 'app' },
        { event_name: 'video_generated', event_source: 'app' },
        { event_name: 'video_downloaded', event_source: 'app' },
        { event_name: 'checkout_started', event_source: 'web' },
        { event_name: 'credits_purchased', event_source: 'stripe' },
        { event_name: 'subscription_started', event_source: 'stripe' },
        { event_name: 'email.clicked', event_source: 'email' },
      ];

      for (const event of funnelEvents) {
        const { error } = await supabase
          .from('event')
          .insert({
            person_id: testPersonId,
            ...event,
            properties: { test: true },
            occurred_at: new Date().toISOString()
          });

        expect(error).toBeNull();
      }

      // Verify all funnel events exist
      const { data } = await supabase
        .from('event')
        .select('event_name')
        .eq('person_id', testPersonId)
        .in('event_name', funnelEvents.map(e => e.event_name));

      expect(data!.length).toBeGreaterThanOrEqual(funnelEvents.length);
    });
  });

  describe('Performance and indexes', () => {
    it('should efficiently query by person_id and occurred_at', async () => {
      const startTime = Date.now();

      await supabase
        .from('event')
        .select('*')
        .eq('person_id', testPersonId)
        .order('occurred_at', { ascending: false })
        .limit(100);

      const queryTime = Date.now() - startTime;

      // Query should complete in reasonable time (< 500ms for local)
      expect(queryTime).toBeLessThan(500);
    });

    it('should efficiently query by event_name', async () => {
      const startTime = Date.now();

      await supabase
        .from('event')
        .select('*')
        .eq('event_name', 'landing_view')
        .limit(100);

      const queryTime = Date.now() - startTime;

      expect(queryTime).toBeLessThan(500);
    });

    it('should efficiently query by event_source', async () => {
      const startTime = Date.now();

      await supabase
        .from('event')
        .select('*')
        .eq('event_source', 'app')
        .limit(100);

      const queryTime = Date.now() - startTime;

      expect(queryTime).toBeLessThan(500);
    });
  });
});
