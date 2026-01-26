/**
 * GDP-007: Integration test for Stripe Webhook Edge Function
 *
 * Tests database interactions for Stripe subscription events
 * - Handle subscription events
 * - Map stripe_customer_id to person_id
 * - Store subscription data in Growth Data Plane
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

describe('GDP-007: Stripe Webhook Database Integration', () => {
  let supabase: ReturnType<typeof createClient>;
  const testCleanupIds: {
    persons: string[];
    identityLinks: string[];
    subscriptions: string[];
    events: string[];
  } = {
    persons: [],
    identityLinks: [],
    subscriptions: [],
    events: [],
  };

  beforeAll(() => {
    supabase = createClient(supabaseUrl, supabaseKey);
  });

  afterEach(async () => {
    // Cleanup in reverse order of dependencies
    for (const id of testCleanupIds.events) {
      await supabase.from('event').delete().eq('id', id);
    }
    for (const id of testCleanupIds.subscriptions) {
      await supabase.from('subscription').delete().eq('id', id);
    }
    for (const id of testCleanupIds.identityLinks) {
      await supabase.from('identity_link').delete().eq('id', id);
    }
    for (const id of testCleanupIds.persons) {
      await supabase.from('person').delete().eq('id', id);
    }

    // Reset cleanup arrays
    testCleanupIds.persons = [];
    testCleanupIds.identityLinks = [];
    testCleanupIds.subscriptions = [];
    testCleanupIds.events = [];
  });

  it('should have subscription table', async () => {
    const { data, error } = await supabase
      .from('subscription')
      .select('*')
      .limit(1);

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it('should create person with stripe identity link', async () => {
    // Create a test person
    const { data: person, error: personError } = await supabase
      .from('person')
      .insert({
        email: 'stripe-test@example.com',
        first_name: 'Stripe',
        last_name: 'Test',
      })
      .select()
      .single();

    expect(personError).toBeNull();
    expect(person).toBeDefined();
    testCleanupIds.persons.push(person!.id);

    // Create identity link for Stripe customer
    const stripeCustomerId = 'cus_test_' + Date.now();
    const { data: identityLink, error: linkError } = await supabase
      .from('identity_link')
      .insert({
        person_id: person!.id,
        source: 'stripe',
        external_id: stripeCustomerId,
        metadata: {
          customer_email: 'stripe-test@example.com',
        },
      })
      .select()
      .single();

    expect(linkError).toBeNull();
    expect(identityLink).toBeDefined();
    expect(identityLink!.source).toBe('stripe');
    expect(identityLink!.external_id).toBe(stripeCustomerId);
    testCleanupIds.identityLinks.push(identityLink!.id);
  });

  it('should find person by stripe_customer_id via identity_link', async () => {
    // Create a test person
    const { data: person, error: personError } = await supabase
      .from('person')
      .insert({
        email: 'lookup-test@example.com',
        first_name: 'Lookup',
        last_name: 'Test',
      })
      .select()
      .single();

    expect(personError).toBeNull();
    testCleanupIds.persons.push(person!.id);

    // Create identity link
    const stripeCustomerId = 'cus_lookup_' + Date.now();
    const { data: identityLink } = await supabase
      .from('identity_link')
      .insert({
        person_id: person!.id,
        source: 'stripe',
        external_id: stripeCustomerId,
      })
      .select()
      .single();

    testCleanupIds.identityLinks.push(identityLink!.id);

    // Lookup person by stripe_customer_id
    const { data: foundLink, error: lookupError } = await supabase
      .from('identity_link')
      .select('person_id')
      .eq('source', 'stripe')
      .eq('external_id', stripeCustomerId)
      .single();

    expect(lookupError).toBeNull();
    expect(foundLink).toBeDefined();
    expect(foundLink!.person_id).toBe(person!.id);
  });

  it('should create subscription record for person', async () => {
    // Create a test person
    const { data: person, error: personError } = await supabase
      .from('person')
      .insert({
        email: 'subscription-test@example.com',
      })
      .select()
      .single();

    expect(personError).toBeNull();
    testCleanupIds.persons.push(person!.id);

    // Create subscription
    const stripeSubscriptionId = 'sub_test_' + Date.now();
    const { data: subscription, error: subError } = await supabase
      .from('subscription')
      .insert({
        person_id: person!.id,
        stripe_subscription_id: stripeSubscriptionId,
        status: 'active',
        plan_name: 'Creator',
        plan_id: 'price_creator_monthly',
        mrr: 29.99,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    expect(subError).toBeNull();
    expect(subscription).toBeDefined();
    expect(subscription!.person_id).toBe(person!.id);
    expect(subscription!.status).toBe('active');
    expect(subscription!.mrr).toBe(29.99);
    testCleanupIds.subscriptions.push(subscription!.id);
  });

  it('should update subscription status', async () => {
    // Create a test person and subscription
    const { data: person } = await supabase
      .from('person')
      .insert({ email: 'update-test@example.com' })
      .select()
      .single();

    testCleanupIds.persons.push(person!.id);

    const stripeSubscriptionId = 'sub_update_' + Date.now();
    const { data: subscription } = await supabase
      .from('subscription')
      .insert({
        person_id: person!.id,
        stripe_subscription_id: stripeSubscriptionId,
        status: 'active',
        plan_name: 'Creator',
        mrr: 29.99,
      })
      .select()
      .single();

    testCleanupIds.subscriptions.push(subscription!.id);

    // Update subscription status
    const { data: updated, error: updateError } = await supabase
      .from('subscription')
      .update({ status: 'canceled', canceled_at: new Date().toISOString() })
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .select()
      .single();

    expect(updateError).toBeNull();
    expect(updated).toBeDefined();
    expect(updated!.status).toBe('canceled');
    expect(updated!.canceled_at).toBeDefined();
  });

  it('should upsert subscription by stripe_subscription_id', async () => {
    // Create a test person
    const { data: person } = await supabase
      .from('person')
      .insert({ email: 'upsert-sub@example.com' })
      .select()
      .single();

    testCleanupIds.persons.push(person!.id);

    const stripeSubscriptionId = 'sub_upsert_' + Date.now();

    // First insert
    const { data: first, error: firstError } = await supabase
      .from('subscription')
      .upsert(
        {
          stripe_subscription_id: stripeSubscriptionId,
          person_id: person!.id,
          status: 'active',
          plan_name: 'Hobbyist',
          mrr: 9.99,
        },
        { onConflict: 'stripe_subscription_id' }
      )
      .select()
      .single();

    expect(firstError).toBeNull();
    expect(first!.plan_name).toBe('Hobbyist');
    testCleanupIds.subscriptions.push(first!.id);

    // Second upsert with same stripe_subscription_id
    const { data: second, error: secondError } = await supabase
      .from('subscription')
      .upsert(
        {
          stripe_subscription_id: stripeSubscriptionId,
          person_id: person!.id,
          status: 'active',
          plan_name: 'Creator', // Changed plan
          mrr: 29.99, // Changed MRR
        },
        { onConflict: 'stripe_subscription_id' }
      )
      .select()
      .single();

    expect(secondError).toBeNull();
    expect(second!.id).toBe(first!.id); // Same record
    expect(second!.plan_name).toBe('Creator'); // Updated
    expect(second!.mrr).toBe(29.99); // Updated
  });

  it('should create event for subscription created', async () => {
    // Create a test person
    const { data: person } = await supabase
      .from('person')
      .insert({ email: 'event-test@example.com' })
      .select()
      .single();

    testCleanupIds.persons.push(person!.id);

    // Create event for subscription
    const { data: event, error: eventError } = await supabase
      .from('event')
      .insert({
        person_id: person!.id,
        event_name: 'subscription_created',
        event_source: 'stripe',
        properties: {
          plan: 'Creator',
          mrr: 29.99,
          status: 'active',
        },
        occurred_at: new Date().toISOString(),
      })
      .select()
      .single();

    expect(eventError).toBeNull();
    expect(event).toBeDefined();
    expect(event!.event_name).toBe('subscription_created');
    expect(event!.event_source).toBe('stripe');
    expect(event!.properties).toHaveProperty('plan', 'Creator');
    testCleanupIds.events.push(event!.id);
  });

  it('should handle subscription status changes in events', async () => {
    // Create a test person
    const { data: person } = await supabase
      .from('person')
      .insert({ email: 'status-change@example.com' })
      .select()
      .single();

    testCleanupIds.persons.push(person!.id);

    // Create multiple events for status changes
    const events = [
      { status: 'trialing', event_name: 'subscription_trial_started' },
      { status: 'active', event_name: 'subscription_activated' },
      { status: 'past_due', event_name: 'subscription_past_due' },
      { status: 'canceled', event_name: 'subscription_canceled' },
    ];

    for (const evt of events) {
      const { data: event, error } = await supabase
        .from('event')
        .insert({
          person_id: person!.id,
          event_name: evt.event_name,
          event_source: 'stripe',
          properties: {
            status: evt.status,
          },
          occurred_at: new Date().toISOString(),
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(event!.event_name).toBe(evt.event_name);
      testCleanupIds.events.push(event!.id);
    }

    // Verify all events were created
    const { data: allEvents, error: queryError } = await supabase
      .from('event')
      .select('*')
      .eq('person_id', person!.id)
      .eq('event_source', 'stripe');

    expect(queryError).toBeNull();
    expect(allEvents).toHaveLength(4);
  });
});
