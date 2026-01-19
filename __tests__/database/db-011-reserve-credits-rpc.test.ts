/**
 * Reserve Credits RPC Function Tests
 * Feature: DB-011 - Reserve Credits RPC Function
 *
 * Tests the reserve_credits RPC function which:
 * - Reserves credits for a job
 * - Returns FALSE if insufficient balance
 * - Returns TRUE if successful
 * - Creates a 'reserve' type transaction
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// These tests require a running Supabase instance
// Run: pnpm supabase start
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54341';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Test user IDs (will be created in beforeAll if needed)
let TEST_USER_ID: string;
let TEST_JOB_ID: string;
let ANOTHER_JOB_ID: string;

describe('DB-011: reserve_credits RPC Function', () => {
  beforeAll(async () => {
    // Create test user in auth.users
    const { data: user1, error: error1 } = await supabase.auth.admin.createUser({
      email: 'test-reserve-credits@example.com',
      password: 'test123456',
      email_confirm: true,
    });

    if (!user1?.user) {
      throw new Error('Failed to create test user');
    }

    TEST_USER_ID = user1.user.id;

    // Clean up any existing test data
    await supabase
      .from('credit_ledger')
      .delete()
      .eq('user_id', TEST_USER_ID);

    // Create test job IDs
    TEST_JOB_ID = '11111111-1111-1111-1111-111111111111';
    ANOTHER_JOB_ID = '22222222-2222-2222-2222-222222222222';

    // Create a test project (required for jobs)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        user_id: TEST_USER_ID,
        title: 'Test Project for Reserve Credits',
        prompt_text: 'Test prompt',
        niche_preset: 'motivation',
        target_minutes: 1,
      })
      .select()
      .single();

    if (projectError || !project) {
      throw new Error(`Failed to create test project: ${projectError?.message}`);
    }

    // Create test jobs
    const { error: jobError } = await supabase.from('jobs').insert([
      {
        id: TEST_JOB_ID,
        project_id: project.id,
        user_id: TEST_USER_ID,
        status: 'QUEUED',
      },
      {
        id: ANOTHER_JOB_ID,
        project_id: project.id,
        user_id: TEST_USER_ID,
        status: 'QUEUED',
      },
    ]);

    if (jobError) {
      throw new Error(`Failed to create test jobs: ${jobError.message}`);
    }
  });

  afterAll(async () => {
    // Clean up test data
    await supabase
      .from('credit_ledger')
      .delete()
      .eq('user_id', TEST_USER_ID);

    // Delete test user
    if (TEST_USER_ID) {
      await supabase.auth.admin.deleteUser(TEST_USER_ID);
    }
  });

  describe('Function Existence', () => {
    it('should have reserve_credits RPC function defined', async () => {
      // Try to call the function - it should exist
      const { data, error } = await supabase.rpc('reserve_credits', {
        p_user_id: TEST_USER_ID,
        p_job_id: TEST_JOB_ID,
        p_amount: 10,
      });

      // Function should exist (even if it fails due to insufficient balance)
      if (error) {
        expect(error.message).not.toContain('does not exist');
      }
    });
  });

  describe('Insufficient Balance', () => {
    it('should return FALSE when user has no credits', async () => {
      // Clean slate - no credits
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      const { data, error } = await supabase.rpc('reserve_credits', {
        p_user_id: TEST_USER_ID,
        p_job_id: TEST_JOB_ID,
        p_amount: 10,
      });

      expect(error).toBeNull();
      expect(data).toBe(false);
    });

    it('should return FALSE when requesting more credits than available', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Give user 50 credits
      await supabase.from('credit_ledger').insert({
        user_id: TEST_USER_ID,
        type: 'purchase',
        amount: 50,
        note: 'Test purchase',
      });

      // Try to reserve 60 credits (more than available)
      const { data, error } = await supabase.rpc('reserve_credits', {
        p_user_id: TEST_USER_ID,
        p_job_id: TEST_JOB_ID,
        p_amount: 60,
      });

      expect(error).toBeNull();
      expect(data).toBe(false);
    });

    it('should not create transaction when balance is insufficient', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Give user 10 credits
      await supabase.from('credit_ledger').insert({
        user_id: TEST_USER_ID,
        type: 'purchase',
        amount: 10,
        note: 'Test purchase',
      });

      // Try to reserve 20 credits (should fail)
      await supabase.rpc('reserve_credits', {
        p_user_id: TEST_USER_ID,
        p_job_id: TEST_JOB_ID,
        p_amount: 20,
      });

      // Check no reserve transaction was created
      const { data: transactions } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('user_id', TEST_USER_ID)
        .eq('type', 'reserve');

      expect(transactions).toHaveLength(0);
    });
  });

  describe('Successful Reservation', () => {
    it('should return TRUE when user has sufficient credits', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Give user 100 credits
      await supabase.from('credit_ledger').insert({
        user_id: TEST_USER_ID,
        type: 'purchase',
        amount: 100,
        note: 'Test purchase',
      });

      // Reserve 50 credits
      const { data, error } = await supabase.rpc('reserve_credits', {
        p_user_id: TEST_USER_ID,
        p_job_id: TEST_JOB_ID,
        p_amount: 50,
      });

      expect(error).toBeNull();
      expect(data).toBe(true);
    });

    it('should create a reserve transaction with negative amount', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Give user 100 credits
      await supabase.from('credit_ledger').insert({
        user_id: TEST_USER_ID,
        type: 'purchase',
        amount: 100,
        note: 'Test purchase',
      });

      // Reserve 30 credits
      await supabase.rpc('reserve_credits', {
        p_user_id: TEST_USER_ID,
        p_job_id: TEST_JOB_ID,
        p_amount: 30,
      });

      // Check reserve transaction was created
      const { data: transactions } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('user_id', TEST_USER_ID)
        .eq('type', 'reserve')
        .eq('job_id', TEST_JOB_ID);

      expect(transactions).toHaveLength(1);
      expect(transactions![0].amount).toBe(-30);
      expect(transactions![0].note).toContain('Reserved');
    });

    it('should correctly update balance after reservation', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Give user 100 credits
      await supabase.from('credit_ledger').insert({
        user_id: TEST_USER_ID,
        type: 'purchase',
        amount: 100,
        note: 'Test purchase',
      });

      // Reserve 25 credits
      await supabase.rpc('reserve_credits', {
        p_user_id: TEST_USER_ID,
        p_job_id: TEST_JOB_ID,
        p_amount: 25,
      });

      // Check new balance
      const { data: balance } = await supabase.rpc('get_credit_balance', {
        p_user_id: TEST_USER_ID,
      });

      expect(balance).toBe(75); // 100 - 25
    });

    it('should allow exact balance reservation', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Give user 50 credits
      await supabase.from('credit_ledger').insert({
        user_id: TEST_USER_ID,
        type: 'purchase',
        amount: 50,
        note: 'Test purchase',
      });

      // Reserve exactly 50 credits
      const { data, error } = await supabase.rpc('reserve_credits', {
        p_user_id: TEST_USER_ID,
        p_job_id: TEST_JOB_ID,
        p_amount: 50,
      });

      expect(error).toBeNull();
      expect(data).toBe(true);

      // Check balance is now 0
      const { data: balance } = await supabase.rpc('get_credit_balance', {
        p_user_id: TEST_USER_ID,
      });

      expect(balance).toBe(0);
    });
  });

  describe('Multiple Reservations', () => {
    it('should allow multiple reservations for different jobs', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Give user 100 credits
      await supabase.from('credit_ledger').insert({
        user_id: TEST_USER_ID,
        type: 'purchase',
        amount: 100,
        note: 'Test purchase',
      });

      // Reserve for first job
      const { data: result1 } = await supabase.rpc('reserve_credits', {
        p_user_id: TEST_USER_ID,
        p_job_id: TEST_JOB_ID,
        p_amount: 30,
      });

      // Reserve for second job
      const { data: result2 } = await supabase.rpc('reserve_credits', {
        p_user_id: TEST_USER_ID,
        p_job_id: ANOTHER_JOB_ID,
        p_amount: 40,
      });

      expect(result1).toBe(true);
      expect(result2).toBe(true);

      // Check final balance
      const { data: balance } = await supabase.rpc('get_credit_balance', {
        p_user_id: TEST_USER_ID,
      });

      expect(balance).toBe(30); // 100 - 30 - 40
    });

    it('should fail second reservation if total would exceed balance', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Give user 50 credits
      await supabase.from('credit_ledger').insert({
        user_id: TEST_USER_ID,
        type: 'purchase',
        amount: 50,
        note: 'Test purchase',
      });

      // Reserve 30 credits for first job
      await supabase.rpc('reserve_credits', {
        p_user_id: TEST_USER_ID,
        p_job_id: TEST_JOB_ID,
        p_amount: 30,
      });

      // Try to reserve 30 more (would exceed balance of 50)
      const { data: result2 } = await supabase.rpc('reserve_credits', {
        p_user_id: TEST_USER_ID,
        p_job_id: ANOTHER_JOB_ID,
        p_amount: 30,
      });

      expect(result2).toBe(false);

      // Balance should still be 20
      const { data: balance } = await supabase.rpc('get_credit_balance', {
        p_user_id: TEST_USER_ID,
      });

      expect(balance).toBe(20); // 50 - 30
    });
  });

  describe('Edge Cases', () => {
    it('should handle reservation of 1 credit', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Give user 10 credits
      await supabase.from('credit_ledger').insert({
        user_id: TEST_USER_ID,
        type: 'purchase',
        amount: 10,
        note: 'Test purchase',
      });

      // Reserve 1 credit
      const { data, error } = await supabase.rpc('reserve_credits', {
        p_user_id: TEST_USER_ID,
        p_job_id: TEST_JOB_ID,
        p_amount: 1,
      });

      expect(error).toBeNull();
      expect(data).toBe(true);

      const { data: balance } = await supabase.rpc('get_credit_balance', {
        p_user_id: TEST_USER_ID,
      });

      expect(balance).toBe(9);
    });

    it('should associate reservation with correct job_id', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Give user 100 credits
      await supabase.from('credit_ledger').insert({
        user_id: TEST_USER_ID,
        type: 'purchase',
        amount: 100,
        note: 'Test purchase',
      });

      // Reserve credits
      await supabase.rpc('reserve_credits', {
        p_user_id: TEST_USER_ID,
        p_job_id: TEST_JOB_ID,
        p_amount: 15,
      });

      // Check job_id is correct
      const { data: transactions } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('user_id', TEST_USER_ID)
        .eq('type', 'reserve');

      expect(transactions).toHaveLength(1);
      expect(transactions![0].job_id).toBe(TEST_JOB_ID);
    });
  });

  describe('Function Signature', () => {
    it('should return BOOLEAN type', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Give user credits
      await supabase.from('credit_ledger').insert({
        user_id: TEST_USER_ID,
        type: 'purchase',
        amount: 100,
        note: 'Test purchase',
      });

      const { data } = await supabase.rpc('reserve_credits', {
        p_user_id: TEST_USER_ID,
        p_job_id: TEST_JOB_ID,
        p_amount: 10,
      });

      expect(typeof data).toBe('boolean');
    });
  });
});
