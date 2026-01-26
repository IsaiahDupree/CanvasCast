/**
 * GDP-008: Integration test for Subscription Snapshot
 *
 * Tests that subscription data from Stripe events is correctly
 * upserted with status, plan, and MRR tracking
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

describe('GDP-008: Subscription Snapshot', () => {
  let supabase: ReturnType<typeof createClient>;
  const testCleanupIds: {
    persons: string[];
    subscriptions: string[];
  } = {
    persons: [],
    subscriptions: [],
  };

  beforeAll(() => {
    supabase = createClient(supabaseUrl, supabaseKey);
  });

  afterEach(async () => {
    // Cleanup in reverse order of dependencies
    for (const id of testCleanupIds.subscriptions) {
      await supabase.from('subscription').delete().eq('id', id);
    }
    for (const id of testCleanupIds.persons) {
      await supabase.from('person').delete().eq('id', id);
    }

    testCleanupIds.persons = [];
    testCleanupIds.subscriptions = [];
  });

  it('should create subscription snapshot with all required fields', async () => {
    // Create test person
    const { data: person } = await supabase
      .from('person')
      .insert({ email: 'snapshot-test@example.com' })
      .select()
      .single();

    testCleanupIds.persons.push(person!.id);

    // Create subscription snapshot
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const { data: subscription, error } = await supabase
      .from('subscription')
      .insert({
        person_id: person!.id,
        stripe_subscription_id: 'sub_snapshot_' + Date.now(),
        status: 'active',
        plan_name: 'Creator',
        plan_id: 'price_creator_monthly',
        mrr: 29.99,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(subscription).toBeDefined();
    expect(subscription!.status).toBe('active');
    expect(subscription!.plan_name).toBe('Creator');
    expect(subscription!.mrr).toBe(29.99);
    expect(subscription!.current_period_start).toBeDefined();
    expect(subscription!.current_period_end).toBeDefined();

    testCleanupIds.subscriptions.push(subscription!.id);
  });

  it('should track MRR changes when plan changes', async () => {
    const { data: person } = await supabase
      .from('person')
      .insert({ email: 'mrr-test@example.com' })
      .select()
      .single();

    testCleanupIds.persons.push(person!.id);

    const stripeSubId = 'sub_mrr_' + Date.now();

    // Create initial subscription with Hobbyist plan
    const { data: initial } = await supabase
      .from('subscription')
      .insert({
        person_id: person!.id,
        stripe_subscription_id: stripeSubId,
        status: 'active',
        plan_name: 'Hobbyist',
        plan_id: 'price_hobbyist_monthly',
        mrr: 9.99,
      })
      .select()
      .single();

    testCleanupIds.subscriptions.push(initial!.id);

    expect(initial!.mrr).toBe(9.99);

    // Upgrade to Creator plan
    const { data: upgraded, error: upgradeError } = await supabase
      .from('subscription')
      .upsert(
        {
          stripe_subscription_id: stripeSubId,
          person_id: person!.id,
          status: 'active',
          plan_name: 'Creator',
          plan_id: 'price_creator_monthly',
          mrr: 29.99,
        },
        { onConflict: 'stripe_subscription_id' }
      )
      .select()
      .single();

    expect(upgradeError).toBeNull();
    expect(upgraded!.id).toBe(initial!.id); // Same record
    expect(upgraded!.mrr).toBe(29.99); // Updated MRR
    expect(upgraded!.plan_name).toBe('Creator'); // Updated plan
  });

  it('should track all subscription statuses', async () => {
    const { data: person } = await supabase
      .from('person')
      .insert({ email: 'status-test@example.com' })
      .select()
      .single();

    testCleanupIds.persons.push(person!.id);

    const stripeSubId = 'sub_status_' + Date.now();

    // Test all possible statuses
    const statuses = ['trialing', 'active', 'past_due', 'canceled', 'unpaid'] as const;

    for (const status of statuses) {
      const { data: subscription, error } = await supabase
        .from('subscription')
        .upsert(
          {
            stripe_subscription_id: stripeSubId,
            person_id: person!.id,
            status: status,
            plan_name: 'Creator',
            mrr: 29.99,
          },
          { onConflict: 'stripe_subscription_id' }
        )
        .select()
        .single();

      expect(error).toBeNull();
      expect(subscription!.status).toBe(status);

      if (!testCleanupIds.subscriptions.includes(subscription!.id)) {
        testCleanupIds.subscriptions.push(subscription!.id);
      }
    }
  });

  it('should track canceled_at timestamp when subscription ends', async () => {
    const { data: person } = await supabase
      .from('person')
      .insert({ email: 'canceled-test@example.com' })
      .select()
      .single();

    testCleanupIds.persons.push(person!.id);

    const stripeSubId = 'sub_cancel_' + Date.now();

    // Create active subscription
    const { data: active } = await supabase
      .from('subscription')
      .insert({
        person_id: person!.id,
        stripe_subscription_id: stripeSubId,
        status: 'active',
        plan_name: 'Creator',
        mrr: 29.99,
      })
      .select()
      .single();

    testCleanupIds.subscriptions.push(active!.id);

    expect(active!.canceled_at).toBeNull();

    // Cancel subscription
    const canceledAt = new Date().toISOString();
    const { data: canceled, error } = await supabase
      .from('subscription')
      .update({
        status: 'canceled',
        canceled_at: canceledAt,
      })
      .eq('stripe_subscription_id', stripeSubId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(canceled!.status).toBe('canceled');
    expect(canceled!.canceled_at).toBeDefined();
    // Allow for timezone format differences (Z vs +00:00)
    expect(new Date(canceled!.canceled_at!).getTime()).toBe(new Date(canceledAt).getTime());
  });

  it('should handle subscription with no MRR (free trial)', async () => {
    const { data: person } = await supabase
      .from('person')
      .insert({ email: 'trial-test@example.com' })
      .select()
      .single();

    testCleanupIds.persons.push(person!.id);

    const { data: subscription, error } = await supabase
      .from('subscription')
      .insert({
        person_id: person!.id,
        stripe_subscription_id: 'sub_trial_' + Date.now(),
        status: 'trialing',
        plan_name: 'Creator',
        plan_id: 'price_creator_monthly',
        mrr: 0, // No MRR during trial
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(subscription!.status).toBe('trialing');
    expect(subscription!.mrr).toBe(0);

    testCleanupIds.subscriptions.push(subscription!.id);
  });

  it('should maintain subscription history via updated_at trigger', async () => {
    const { data: person } = await supabase
      .from('person')
      .insert({ email: 'history-test@example.com' })
      .select()
      .single();

    testCleanupIds.persons.push(person!.id);

    const stripeSubId = 'sub_history_' + Date.now();

    // Create subscription
    const { data: created } = await supabase
      .from('subscription')
      .insert({
        person_id: person!.id,
        stripe_subscription_id: stripeSubId,
        status: 'active',
        plan_name: 'Creator',
        mrr: 29.99,
      })
      .select()
      .single();

    testCleanupIds.subscriptions.push(created!.id);

    const originalUpdatedAt = created!.updated_at;

    // Wait a bit to ensure timestamp differs
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Update subscription
    const { data: updated } = await supabase
      .from('subscription')
      .update({ status: 'past_due' })
      .eq('stripe_subscription_id', stripeSubId)
      .select()
      .single();

    expect(updated!.updated_at).not.toBe(originalUpdatedAt);
    expect(new Date(updated!.updated_at).getTime()).toBeGreaterThan(
      new Date(originalUpdatedAt).getTime()
    );
  });

  it('should query active subscriptions by person', async () => {
    const { data: person } = await supabase
      .from('person')
      .insert({ email: 'query-test@example.com' })
      .select()
      .single();

    testCleanupIds.persons.push(person!.id);

    // Create multiple subscriptions (simulating history)
    const subs = [
      {
        stripe_subscription_id: 'sub_query_1_' + Date.now(),
        status: 'canceled',
        plan_name: 'Hobbyist',
        mrr: 9.99,
      },
      {
        stripe_subscription_id: 'sub_query_2_' + Date.now(),
        status: 'active',
        plan_name: 'Creator',
        mrr: 29.99,
      },
    ];

    for (const sub of subs) {
      const { data } = await supabase
        .from('subscription')
        .insert({
          person_id: person!.id,
          ...sub,
        })
        .select()
        .single();

      testCleanupIds.subscriptions.push(data!.id);
    }

    // Query active subscriptions only
    const { data: activeSubscriptions, error } = await supabase
      .from('subscription')
      .select('*')
      .eq('person_id', person!.id)
      .eq('status', 'active');

    expect(error).toBeNull();
    expect(activeSubscriptions).toHaveLength(1);
    expect(activeSubscriptions![0].plan_name).toBe('Creator');
    expect(activeSubscriptions![0].mrr).toBe(29.99);
  });

  it('should calculate total MRR across all active subscriptions', async () => {
    const { data: person } = await supabase
      .from('person')
      .insert({ email: 'mrr-calc-test@example.com' })
      .select()
      .single();

    testCleanupIds.persons.push(person!.id);

    // Create multiple active subscriptions (edge case: user has multiple)
    const subscriptions = [
      { mrr: 29.99, plan_name: 'Creator' },
      { mrr: 49.99, plan_name: 'Business' },
    ];

    for (const sub of subscriptions) {
      const { data } = await supabase
        .from('subscription')
        .insert({
          person_id: person!.id,
          stripe_subscription_id: 'sub_multi_' + Date.now() + Math.random(),
          status: 'active',
          ...sub,
        })
        .select()
        .single();

      testCleanupIds.subscriptions.push(data!.id);
    }

    // Query and sum MRR
    const { data: allSubs, error } = await supabase
      .from('subscription')
      .select('mrr')
      .eq('person_id', person!.id)
      .eq('status', 'active');

    expect(error).toBeNull();
    const totalMrr = allSubs!.reduce((sum, sub) => sum + Number(sub.mrr), 0);
    expect(totalMrr).toBe(79.98);
  });
});
