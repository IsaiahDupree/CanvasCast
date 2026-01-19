/**
 * Release Job Credits RPC Function Tests
 * Feature: DB-013 - Release Job Credits RPC Function
 *
 * Tests the release_job_credits RPC function which:
 * - Releases reserved credits on job failure
 * - Converts 'reserve' type to 'refund' type
 * - Flips amount sign from negative to positive
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

describe('DB-013: release_job_credits RPC Function', () => {
  beforeAll(async () => {
    // Create test user in auth.users
    const { data: user1, error: error1 } = await supabase.auth.admin.createUser({
      email: 'test-release-credits@example.com',
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
    TEST_JOB_ID = '55555555-5555-5555-5555-555555555555';
    ANOTHER_JOB_ID = '66666666-6666-6666-6666-666666666666';

    // Create a test project (required for jobs)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        user_id: TEST_USER_ID,
        title: 'Test Project for Release Credits',
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
    it('should have release_job_credits RPC function defined', async () => {
      // Try to call the function - it should exist
      const { error } = await supabase.rpc('release_job_credits', {
        p_job_id: TEST_JOB_ID,
      });

      // Function should exist
      if (error) {
        expect(error.message).not.toContain('does not exist');
      }
    });
  });

  describe('Converting Reserve to Refund', () => {
    it('should convert reserve transaction to refund on release', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Give user credits and reserve some
      await supabase.from('credit_ledger').insert([
        {
          user_id: TEST_USER_ID,
          type: 'purchase',
          amount: 100,
          note: 'Test purchase',
        },
        {
          user_id: TEST_USER_ID,
          type: 'reserve',
          amount: -50,
          job_id: TEST_JOB_ID,
          note: 'Reserved for job',
        },
      ]);

      // Release the credits
      await supabase.rpc('release_job_credits', {
        p_job_id: TEST_JOB_ID,
      });

      // Check that reserve was converted to refund
      const { data: reserveTransactions } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('user_id', TEST_USER_ID)
        .eq('job_id', TEST_JOB_ID)
        .eq('type', 'reserve');

      const { data: refundTransactions } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('user_id', TEST_USER_ID)
        .eq('job_id', TEST_JOB_ID)
        .eq('type', 'refund');

      expect(reserveTransactions).toHaveLength(0);
      expect(refundTransactions).toHaveLength(1);
      expect(refundTransactions![0].note).toContain('failed');
    });

    it('should flip amount sign from negative to positive', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Give user credits and reserve 30
      await supabase.from('credit_ledger').insert([
        {
          user_id: TEST_USER_ID,
          type: 'purchase',
          amount: 100,
          note: 'Test purchase',
        },
        {
          user_id: TEST_USER_ID,
          type: 'reserve',
          amount: -30,
          job_id: TEST_JOB_ID,
          note: 'Reserved for job',
        },
      ]);

      // Release the credits
      await supabase.rpc('release_job_credits', {
        p_job_id: TEST_JOB_ID,
      });

      // Check refund amount is positive
      const { data: refundTransactions } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('user_id', TEST_USER_ID)
        .eq('job_id', TEST_JOB_ID)
        .eq('type', 'refund');

      expect(refundTransactions).toHaveLength(1);
      expect(refundTransactions![0].amount).toBe(30); // Was -30, now +30
    });

    it('should restore balance to original amount after release', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Give user credits and reserve some
      await supabase.from('credit_ledger').insert([
        {
          user_id: TEST_USER_ID,
          type: 'purchase',
          amount: 100,
          note: 'Test purchase',
        },
        {
          user_id: TEST_USER_ID,
          type: 'reserve',
          amount: -40,
          job_id: TEST_JOB_ID,
          note: 'Reserved for job',
        },
      ]);

      // Balance should be 60 (100 - 40)
      const { data: balanceBefore } = await supabase.rpc('get_credit_balance', {
        p_user_id: TEST_USER_ID,
      });

      // Release the credits
      await supabase.rpc('release_job_credits', {
        p_job_id: TEST_JOB_ID,
      });

      // Balance should be back to 100
      const { data: balanceAfter } = await supabase.rpc('get_credit_balance', {
        p_user_id: TEST_USER_ID,
      });

      expect(balanceBefore).toBe(60);
      expect(balanceAfter).toBe(100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle job with no reservation gracefully', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Try to release a job that was never reserved
      const { error } = await supabase.rpc('release_job_credits', {
        p_job_id: TEST_JOB_ID,
      });

      // Should not error
      expect(error).toBeNull();
    });

    it('should only affect the specific job', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Create reservations for two different jobs
      await supabase.from('credit_ledger').insert([
        {
          user_id: TEST_USER_ID,
          type: 'purchase',
          amount: 200,
          note: 'Test purchase',
        },
        {
          user_id: TEST_USER_ID,
          type: 'reserve',
          amount: -50,
          job_id: TEST_JOB_ID,
          note: 'Reserved for job 1',
        },
        {
          user_id: TEST_USER_ID,
          type: 'reserve',
          amount: -60,
          job_id: ANOTHER_JOB_ID,
          note: 'Reserved for job 2',
        },
      ]);

      // Release only the first job
      await supabase.rpc('release_job_credits', {
        p_job_id: TEST_JOB_ID,
      });

      // Check first job is released
      const { data: job1Reserve } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('job_id', TEST_JOB_ID)
        .eq('type', 'reserve');

      const { data: job1Refund } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('job_id', TEST_JOB_ID)
        .eq('type', 'refund');

      // Check second job is still reserved
      const { data: job2Reserve } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('job_id', ANOTHER_JOB_ID)
        .eq('type', 'reserve');

      expect(job1Reserve).toHaveLength(0);
      expect(job1Refund).toHaveLength(1);
      expect(job2Reserve).toHaveLength(1);
    });

    it('should handle release of 1 credit', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Reserve 1 credit
      await supabase.from('credit_ledger').insert([
        {
          user_id: TEST_USER_ID,
          type: 'purchase',
          amount: 100,
          note: 'Test purchase',
        },
        {
          user_id: TEST_USER_ID,
          type: 'reserve',
          amount: -1,
          job_id: TEST_JOB_ID,
          note: 'Reserved for job',
        },
      ]);

      // Release the credit
      await supabase.rpc('release_job_credits', {
        p_job_id: TEST_JOB_ID,
      });

      const { data: refundTransactions } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('user_id', TEST_USER_ID)
        .eq('type', 'refund');

      expect(refundTransactions).toHaveLength(1);
      expect(refundTransactions![0].amount).toBe(1);
    });

    it('should handle multiple reservations for same job', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Create multiple reservations for same job (edge case)
      await supabase.from('credit_ledger').insert([
        {
          user_id: TEST_USER_ID,
          type: 'purchase',
          amount: 200,
          note: 'Test purchase',
        },
        {
          user_id: TEST_USER_ID,
          type: 'reserve',
          amount: -30,
          job_id: TEST_JOB_ID,
          note: 'First reservation',
        },
        {
          user_id: TEST_USER_ID,
          type: 'reserve',
          amount: -20,
          job_id: TEST_JOB_ID,
          note: 'Second reservation',
        },
      ]);

      // Release all reservations for this job
      await supabase.rpc('release_job_credits', {
        p_job_id: TEST_JOB_ID,
      });

      // Check all reserves were converted to refunds
      const { data: reserveTransactions } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('job_id', TEST_JOB_ID)
        .eq('type', 'reserve');

      const { data: refundTransactions } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('job_id', TEST_JOB_ID)
        .eq('type', 'refund');

      expect(reserveTransactions).toHaveLength(0);
      expect(refundTransactions).toHaveLength(2);

      // Balance should be back to 200
      const { data: balance } = await supabase.rpc('get_credit_balance', {
        p_user_id: TEST_USER_ID,
      });

      expect(balance).toBe(200);
    });
  });

  describe('Function Signature', () => {
    it('should accept job_id parameter', async () => {
      const { error } = await supabase.rpc('release_job_credits', {
        p_job_id: TEST_JOB_ID,
      });

      // Should not error on parameter acceptance
      if (error) {
        expect(error.message).not.toContain('parameter');
      }
    });

    it('should return VOID (no return value)', async () => {
      const { data, error } = await supabase.rpc('release_job_credits', {
        p_job_id: TEST_JOB_ID,
      });

      expect(error).toBeNull();
      expect(data).toBeNull();
    });
  });

  describe('Integration Scenarios', () => {
    it('should work in sequence: reserve -> release', async () => {
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

      // Reserve credits using RPC
      const { data: reserveResult } = await supabase.rpc('reserve_credits', {
        p_user_id: TEST_USER_ID,
        p_job_id: TEST_JOB_ID,
        p_amount: 50,
      });

      expect(reserveResult).toBe(true);

      // Balance should be 50
      const { data: balanceAfterReserve } = await supabase.rpc('get_credit_balance', {
        p_user_id: TEST_USER_ID,
      });

      expect(balanceAfterReserve).toBe(50);

      // Release the credits
      await supabase.rpc('release_job_credits', {
        p_job_id: TEST_JOB_ID,
      });

      // Balance should be back to 100
      const { data: balanceAfterRelease } = await supabase.rpc('get_credit_balance', {
        p_user_id: TEST_USER_ID,
      });

      expect(balanceAfterRelease).toBe(100);
    });

    it('should show correct note after release', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Reserve credits
      await supabase.from('credit_ledger').insert([
        {
          user_id: TEST_USER_ID,
          type: 'purchase',
          amount: 100,
          note: 'Test purchase',
        },
        {
          user_id: TEST_USER_ID,
          type: 'reserve',
          amount: -25,
          job_id: TEST_JOB_ID,
          note: 'Reserved for job',
        },
      ]);

      // Release the credits
      await supabase.rpc('release_job_credits', {
        p_job_id: TEST_JOB_ID,
      });

      // Check the note on refund transaction
      const { data: refundTransactions } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('job_id', TEST_JOB_ID)
        .eq('type', 'refund');

      expect(refundTransactions![0].note).toContain('Job failed');
      expect(refundTransactions![0].note).toContain('refunded');
    });
  });
});
