/**
 * Finalize Job Credits RPC Function Tests
 * Feature: DB-012 - Finalize Job Credits RPC Function
 *
 * Tests the finalize_job_credits RPC function which:
 * - Finalizes credits after job completion
 * - Refunds difference if actual cost is less than reserved
 * - Converts 'reserve' type to 'usage' type
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

describe('DB-012: finalize_job_credits RPC Function', () => {
  beforeAll(async () => {
    // Create test user in auth.users
    const { data: user1, error: error1 } = await supabase.auth.admin.createUser({
      email: 'test-finalize-credits@example.com',
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
    TEST_JOB_ID = '33333333-3333-3333-3333-333333333333';
    ANOTHER_JOB_ID = '44444444-4444-4444-4444-444444444444';

    // Create a test project (required for jobs)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        user_id: TEST_USER_ID,
        title: 'Test Project for Finalize Credits',
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
    it('should have finalize_job_credits RPC function defined', async () => {
      // Try to call the function - it should exist
      const { error } = await supabase.rpc('finalize_job_credits', {
        p_user_id: TEST_USER_ID,
        p_job_id: TEST_JOB_ID,
        p_final_cost: 10,
      });

      // Function should exist
      if (error) {
        expect(error.message).not.toContain('does not exist');
      }
    });
  });

  describe('Converting Reserve to Usage', () => {
    it('should convert reserve transaction to usage when finalized', async () => {
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

      // Finalize with same cost
      await supabase.rpc('finalize_job_credits', {
        p_user_id: TEST_USER_ID,
        p_job_id: TEST_JOB_ID,
        p_final_cost: 50,
      });

      // Check that reserve was converted to usage
      const { data: reserveTransactions } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('user_id', TEST_USER_ID)
        .eq('job_id', TEST_JOB_ID)
        .eq('type', 'reserve');

      const { data: usageTransactions } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('user_id', TEST_USER_ID)
        .eq('job_id', TEST_JOB_ID)
        .eq('type', 'usage');

      expect(reserveTransactions).toHaveLength(0);
      expect(usageTransactions).toHaveLength(1);
      expect(usageTransactions![0].amount).toBe(-50);
      expect(usageTransactions![0].note).toContain('completed');
    });

    it('should maintain the same amount when converting reserve to usage', async () => {
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
          amount: -30,
          job_id: TEST_JOB_ID,
          note: 'Reserved for job',
        },
      ]);

      // Get balance before finalize
      const { data: balanceBefore } = await supabase.rpc('get_credit_balance', {
        p_user_id: TEST_USER_ID,
      });

      // Finalize with exact cost
      await supabase.rpc('finalize_job_credits', {
        p_user_id: TEST_USER_ID,
        p_job_id: TEST_JOB_ID,
        p_final_cost: 30,
      });

      // Balance should remain the same (70)
      const { data: balanceAfter } = await supabase.rpc('get_credit_balance', {
        p_user_id: TEST_USER_ID,
      });

      expect(balanceBefore).toBe(70);
      expect(balanceAfter).toBe(70);
    });
  });

  describe('Partial Refund Scenarios', () => {
    it('should issue refund when final cost is less than reserved', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Give user credits and reserve 50
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

      // Finalize with lower cost (30 instead of 50)
      await supabase.rpc('finalize_job_credits', {
        p_user_id: TEST_USER_ID,
        p_job_id: TEST_JOB_ID,
        p_final_cost: 30,
      });

      // Check refund transaction was created
      const { data: refundTransactions } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('user_id', TEST_USER_ID)
        .eq('job_id', TEST_JOB_ID)
        .eq('type', 'refund');

      expect(refundTransactions).toHaveLength(1);
      expect(refundTransactions![0].amount).toBe(20); // 50 - 30 = 20 refund
      expect(refundTransactions![0].note).toContain('Partial refund');
    });

    it('should correctly calculate refund amount', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Give user credits and reserve 100
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
          amount: -100,
          job_id: TEST_JOB_ID,
          note: 'Reserved for job',
        },
      ]);

      // Finalize with 25 credits (75 refund expected)
      await supabase.rpc('finalize_job_credits', {
        p_user_id: TEST_USER_ID,
        p_job_id: TEST_JOB_ID,
        p_final_cost: 25,
      });

      // Check final balance
      const { data: balance } = await supabase.rpc('get_credit_balance', {
        p_user_id: TEST_USER_ID,
      });

      // Should be 200 - 25 = 175 (initial - final_cost)
      expect(balance).toBe(175);

      // Check refund amount
      const { data: refundTransactions } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('user_id', TEST_USER_ID)
        .eq('type', 'refund');

      expect(refundTransactions![0].amount).toBe(75); // 100 - 25
    });

    it('should not issue refund when final cost equals reserved', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Give user credits and reserve 40
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

      // Finalize with exact cost
      await supabase.rpc('finalize_job_credits', {
        p_user_id: TEST_USER_ID,
        p_job_id: TEST_JOB_ID,
        p_final_cost: 40,
      });

      // Check no refund transaction was created
      const { data: refundTransactions } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('user_id', TEST_USER_ID)
        .eq('type', 'refund');

      expect(refundTransactions).toHaveLength(0);
    });

    it('should not issue refund when final cost is greater than reserved', async () => {
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

      // Finalize with higher cost (edge case - shouldn't normally happen)
      await supabase.rpc('finalize_job_credits', {
        p_user_id: TEST_USER_ID,
        p_job_id: TEST_JOB_ID,
        p_final_cost: 50,
      });

      // Check no refund transaction was created
      const { data: refundTransactions } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('user_id', TEST_USER_ID)
        .eq('type', 'refund');

      expect(refundTransactions).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle job with no reservation gracefully', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Try to finalize a job that was never reserved
      const { error } = await supabase.rpc('finalize_job_credits', {
        p_user_id: TEST_USER_ID,
        p_job_id: TEST_JOB_ID,
        p_final_cost: 10,
      });

      // Should not error
      expect(error).toBeNull();
    });

    it('should handle final cost of 0', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Give user credits and reserve 50
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

      // Finalize with 0 cost (full refund)
      await supabase.rpc('finalize_job_credits', {
        p_user_id: TEST_USER_ID,
        p_job_id: TEST_JOB_ID,
        p_final_cost: 0,
      });

      // Should refund full amount
      const { data: refundTransactions } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('user_id', TEST_USER_ID)
        .eq('type', 'refund');

      expect(refundTransactions).toHaveLength(1);
      expect(refundTransactions![0].amount).toBe(50);

      // Balance should be back to 100
      const { data: balance } = await supabase.rpc('get_credit_balance', {
        p_user_id: TEST_USER_ID,
      });

      expect(balance).toBe(100);
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

      // Finalize only the first job
      await supabase.rpc('finalize_job_credits', {
        p_user_id: TEST_USER_ID,
        p_job_id: TEST_JOB_ID,
        p_final_cost: 30,
      });

      // Check first job is finalized
      const { data: job1Reserve } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('job_id', TEST_JOB_ID)
        .eq('type', 'reserve');

      const { data: job1Usage } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('job_id', TEST_JOB_ID)
        .eq('type', 'usage');

      // Check second job is still reserved
      const { data: job2Reserve } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('job_id', ANOTHER_JOB_ID)
        .eq('type', 'reserve');

      expect(job1Reserve).toHaveLength(0);
      expect(job1Usage).toHaveLength(1);
      expect(job2Reserve).toHaveLength(1);
    });

    it('should handle finalize with 1 credit refund', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Reserve 10 credits
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
          amount: -10,
          job_id: TEST_JOB_ID,
          note: 'Reserved for job',
        },
      ]);

      // Finalize with 9 credits (1 refund)
      await supabase.rpc('finalize_job_credits', {
        p_user_id: TEST_USER_ID,
        p_job_id: TEST_JOB_ID,
        p_final_cost: 9,
      });

      const { data: refundTransactions } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('user_id', TEST_USER_ID)
        .eq('type', 'refund');

      expect(refundTransactions).toHaveLength(1);
      expect(refundTransactions![0].amount).toBe(1);
    });
  });

  describe('Function Signature', () => {
    it('should accept required parameters', async () => {
      const { error } = await supabase.rpc('finalize_job_credits', {
        p_user_id: TEST_USER_ID,
        p_job_id: TEST_JOB_ID,
        p_final_cost: 10,
      });

      // Should not error on parameter acceptance
      if (error) {
        expect(error.message).not.toContain('parameter');
      }
    });

    it('should return VOID (no return value)', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      const { data, error } = await supabase.rpc('finalize_job_credits', {
        p_user_id: TEST_USER_ID,
        p_job_id: TEST_JOB_ID,
        p_final_cost: 10,
      });

      expect(error).toBeNull();
      expect(data).toBeNull();
    });
  });
});
