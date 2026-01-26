/**
 * GDP-002: Person & Identity Tables
 * Test suite for person canonical record and identity linking functionality
 *
 * Acceptance Criteria:
 * - Canonical person table with identity links for posthog, stripe, meta
 * - Multiple identity sources can link to same person
 * - Identity lookup works for all sources
 * - Person properties stored correctly
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54341';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

const supabase = createClient(supabaseUrl, supabaseKey);

describe('GDP-002: Person & Identity Tables', () => {
  let testPersonId: string;

  // Clean up test data before each test
  beforeEach(async () => {
    await supabase.from('identity_link').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('person').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  });

  describe('Person Canonical Record', () => {
    it('should create a person with basic properties', async () => {
      const { data: person, error } = await supabase
        .from('person')
        .insert({
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
          properties: { source: 'test', plan: 'free' }
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(person).toBeDefined();
      expect(person?.email).toBe('test@example.com');
      expect(person?.first_name).toBe('John');
      expect(person?.last_name).toBe('Doe');
      expect(person?.properties).toEqual({ source: 'test', plan: 'free' });
      expect(person?.id).toBeDefined();

      testPersonId = person!.id;
    });

    it('should update person properties', async () => {
      // Create person
      const { data: person } = await supabase
        .from('person')
        .insert({
          email: 'update@example.com',
          properties: { plan: 'free' }
        })
        .select()
        .single();

      testPersonId = person!.id;

      // Update properties
      const { data: updated, error } = await supabase
        .from('person')
        .update({
          first_name: 'Jane',
          properties: { plan: 'pro', tier: 'paid' }
        })
        .eq('id', testPersonId)
        .select()
        .single();

      expect(error).toBeNull();
      expect(updated?.first_name).toBe('Jane');
      expect(updated?.properties).toEqual({ plan: 'pro', tier: 'paid' });
    });

    it('should track created_at and updated_at timestamps', async () => {
      const { data: person } = await supabase
        .from('person')
        .insert({
          email: 'timestamp@example.com'
        })
        .select()
        .single();

      expect(person?.created_at).toBeDefined();
      expect(person?.updated_at).toBeDefined();

      const createdAt = new Date(person!.created_at);
      const updatedAt = new Date(person!.updated_at);

      expect(createdAt.getTime()).toBeGreaterThan(0);
      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(createdAt.getTime());

      testPersonId = person!.id;
    });

    it('should allow person without email (anonymous)', async () => {
      const { data: person, error } = await supabase
        .from('person')
        .insert({
          properties: { anonymous: true, session_id: 'anon-123' }
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(person).toBeDefined();
      expect(person?.email).toBeNull();
      expect(person?.properties).toEqual({ anonymous: true, session_id: 'anon-123' });

      testPersonId = person!.id;
    });
  });

  describe('Identity Linking', () => {
    beforeEach(async () => {
      // Create a test person for identity linking tests
      const { data: person } = await supabase
        .from('person')
        .insert({
          email: 'identity@example.com',
          first_name: 'Identity',
          last_name: 'Test'
        })
        .select()
        .single();

      testPersonId = person!.id;
    });

    it('should link PostHog identity to person', async () => {
      const { data: identity, error } = await supabase
        .from('identity_link')
        .insert({
          person_id: testPersonId,
          source: 'posthog',
          external_id: 'ph_user_123456',
          metadata: { distinct_id: 'ph_user_123456' }
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(identity).toBeDefined();
      expect(identity?.source).toBe('posthog');
      expect(identity?.external_id).toBe('ph_user_123456');
      expect(identity?.person_id).toBe(testPersonId);
    });

    it('should link Stripe identity to person', async () => {
      const { data: identity, error } = await supabase
        .from('identity_link')
        .insert({
          person_id: testPersonId,
          source: 'stripe',
          external_id: 'cus_stripeCustomer123',
          metadata: { customer_created: '2024-01-01' }
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(identity?.source).toBe('stripe');
      expect(identity?.external_id).toBe('cus_stripeCustomer123');
    });

    it('should link Meta identity to person', async () => {
      const { data: identity, error } = await supabase
        .from('identity_link')
        .insert({
          person_id: testPersonId,
          source: 'meta',
          external_id: 'fbp_12345',
          metadata: { fbp: 'fbp_12345', fbc: 'fbc_67890' }
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(identity?.source).toBe('meta');
      expect(identity?.external_id).toBe('fbp_12345');
    });

    it('should link multiple identities to same person', async () => {
      // Link PostHog
      await supabase.from('identity_link').insert({
        person_id: testPersonId,
        source: 'posthog',
        external_id: 'ph_multi_123'
      });

      // Link Stripe
      await supabase.from('identity_link').insert({
        person_id: testPersonId,
        source: 'stripe',
        external_id: 'cus_multi_456'
      });

      // Link Meta
      await supabase.from('identity_link').insert({
        person_id: testPersonId,
        source: 'meta',
        external_id: 'fbp_multi_789'
      });

      // Verify all identities linked
      const { data: identities, error } = await supabase
        .from('identity_link')
        .select('*')
        .eq('person_id', testPersonId);

      expect(error).toBeNull();
      expect(identities).toHaveLength(3);

      const sources = identities?.map((i) => i.source).sort();
      expect(sources).toEqual(['meta', 'posthog', 'stripe']);
    });

    it('should enforce unique constraint on source + external_id', async () => {
      // Create first identity
      await supabase.from('identity_link').insert({
        person_id: testPersonId,
        source: 'posthog',
        external_id: 'ph_duplicate_123'
      });

      // Try to create duplicate
      const { error } = await supabase.from('identity_link').insert({
        person_id: testPersonId,
        source: 'posthog',
        external_id: 'ph_duplicate_123'
      });

      expect(error).not.toBeNull();
      expect(error?.code).toBe('23505'); // PostgreSQL unique violation
    });

    it('should look up person by PostHog identity', async () => {
      // Link identity
      await supabase.from('identity_link').insert({
        person_id: testPersonId,
        source: 'posthog',
        external_id: 'ph_lookup_123'
      });

      // Lookup person via identity
      const { data: identities } = await supabase
        .from('identity_link')
        .select('person_id, person(*)')
        .eq('source', 'posthog')
        .eq('external_id', 'ph_lookup_123')
        .single();

      expect(identities?.person_id).toBe(testPersonId);
      expect(identities?.person).toBeDefined();
      expect((identities?.person as any).email).toBe('identity@example.com');
    });

    it('should look up person by Stripe identity', async () => {
      // Link identity
      await supabase.from('identity_link').insert({
        person_id: testPersonId,
        source: 'stripe',
        external_id: 'cus_lookup_456'
      });

      // Lookup person via identity
      const { data: identities } = await supabase
        .from('identity_link')
        .select('person_id, person(*)')
        .eq('source', 'stripe')
        .eq('external_id', 'cus_lookup_456')
        .single();

      expect(identities?.person_id).toBe(testPersonId);
      expect(identities?.person).toBeDefined();
    });

    it('should cascade delete identities when person is deleted', async () => {
      // Link identity
      const { data: identity } = await supabase
        .from('identity_link')
        .insert({
          person_id: testPersonId,
          source: 'posthog',
          external_id: 'ph_cascade_123'
        })
        .select()
        .single();

      const identityId = identity!.id;

      // Delete person
      await supabase.from('person').delete().eq('id', testPersonId);

      // Verify identity was deleted
      const { data: deletedIdentity } = await supabase
        .from('identity_link')
        .select('*')
        .eq('id', identityId)
        .single();

      expect(deletedIdentity).toBeNull();
    });

    it('should store metadata with identity links', async () => {
      const metadata = {
        first_seen: '2024-01-01T00:00:00Z',
        last_activity: '2024-01-26T00:00:00Z',
        device_type: 'mobile',
        attribution: {
          utm_source: 'google',
          utm_campaign: 'brand'
        }
      };

      const { data: identity } = await supabase
        .from('identity_link')
        .insert({
          person_id: testPersonId,
          source: 'posthog',
          external_id: 'ph_metadata_123',
          metadata
        })
        .select()
        .single();

      expect(identity?.metadata).toEqual(metadata);
    });
  });

  describe('Person Lookup & Resolution', () => {
    it('should find person by email', async () => {
      const email = 'findme@example.com';

      const { data: person } = await supabase
        .from('person')
        .insert({ email })
        .select()
        .single();

      testPersonId = person!.id;

      const { data: found } = await supabase
        .from('person')
        .select('*')
        .eq('email', email)
        .single();

      expect(found?.id).toBe(testPersonId);
      expect(found?.email).toBe(email);
    });

    it('should find all identities for a person', async () => {
      const { data: person } = await supabase
        .from('person')
        .insert({ email: 'allidentities@example.com' })
        .select()
        .single();

      testPersonId = person!.id;

      // Add multiple identities
      await supabase.from('identity_link').insert([
        { person_id: testPersonId, source: 'posthog', external_id: 'ph_all_1' },
        { person_id: testPersonId, source: 'stripe', external_id: 'cus_all_2' },
        { person_id: testPersonId, source: 'meta', external_id: 'fbp_all_3' },
        { person_id: testPersonId, source: 'resend', external_id: 'resend_all_4' }
      ]);

      const { data: identities } = await supabase
        .from('identity_link')
        .select('*')
        .eq('person_id', testPersonId)
        .order('source');

      expect(identities).toHaveLength(4);
      expect(identities?.map((i) => i.source)).toEqual(['meta', 'posthog', 'resend', 'stripe']);
    });
  });
});
