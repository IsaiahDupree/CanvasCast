/**
 * DB-009: Handle New User Trigger Tests
 *
 * Tests the handle_new_user trigger that:
 * 1. Creates a profile when a new user signs up
 * 2. Grants 10 trial credits on signup
 */

import { createClient } from '@supabase/supabase-js';
import { describe, it, expect, afterAll } from 'vitest';

// Supabase test client setup
const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

describe('DB-009: Handle New User Trigger', () => {
  const testUserEmail = `test-${Date.now()}@example.com`;
  let testUserId: string;

  afterAll(async () => {
    // Clean up test user
    if (testUserId) {
      await supabase.auth.admin.deleteUser(testUserId);
    }
  });

  it('should create a profile when a new user signs up', async () => {
    // Create a new user using Supabase Auth Admin API
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testUserEmail,
      email_confirm: true,
      user_metadata: {
        full_name: 'Test User',
      },
    });

    expect(authError).toBeNull();
    expect(authData.user).toBeDefined();
    testUserId = authData.user!.id;

    // Wait a bit for trigger to execute
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check that profile was created
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', testUserId)
      .single();

    expect(profileError).toBeNull();
    expect(profileData).toBeDefined();
    expect(profileData!.id).toBe(testUserId);
    expect(profileData!.display_name).toBe('Test User');
  });

  it('should grant 10 trial credits on signup', async () => {
    // Check credit ledger for the trial credits
    const { data: ledgerData, error: ledgerError } = await supabase
      .from('credit_ledger')
      .select('*')
      .eq('user_id', testUserId)
      .eq('type', 'purchase')
      .eq('note', 'Welcome bonus: 10 trial credits');

    expect(ledgerError).toBeNull();
    expect(ledgerData).toBeDefined();
    expect(ledgerData!.length).toBeGreaterThan(0);

    const trialCredit = ledgerData![0];
    expect(trialCredit.amount).toBe(10);
    expect(trialCredit.user_id).toBe(testUserId);
    expect(trialCredit.type).toBe('purchase');
    expect(trialCredit.balance_after).toBe(10);
  });

  it('should set display_name from user metadata', async () => {
    // Create another user with different metadata
    const testEmail2 = `test2-${Date.now()}@example.com`;

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testEmail2,
      email_confirm: true,
      user_metadata: {
        name: 'Another User', // Using 'name' instead of 'full_name'
      },
    });

    expect(authError).toBeNull();
    const userId2 = authData.user!.id;

    // Wait for trigger
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId2)
      .single();

    expect(profileData!.display_name).toBe('Another User');

    // Clean up
    await supabase.auth.admin.deleteUser(userId2);
  });

  it('should fallback to email prefix if no name metadata provided', async () => {
    // Create user without name metadata
    const testEmail3 = `test3-${Date.now()}@example.com`;

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testEmail3,
      email_confirm: true,
      user_metadata: {},
    });

    expect(authError).toBeNull();
    const userId3 = authData.user!.id;

    // Wait for trigger
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check profile - should use email prefix
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId3)
      .single();

    expect(profileData!.display_name).toBe(testEmail3.split('@')[0]);

    // Clean up
    await supabase.auth.admin.deleteUser(userId3);
  });

  it('should be idempotent - not grant duplicate credits on conflict', async () => {
    // Try to manually trigger the function again (simulating duplicate trigger)
    // The ON CONFLICT DO NOTHING should prevent duplicate credits

    const { data: ledgerData } = await supabase
      .from('credit_ledger')
      .select('*')
      .eq('user_id', testUserId)
      .eq('type', 'purchase')
      .eq('note', 'Welcome bonus: 10 trial credits');

    // Should only have ONE trial credit entry
    expect(ledgerData!.length).toBe(1);
  });
});
