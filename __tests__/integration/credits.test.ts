/**
 * TEST-004: Credit Functions Tests
 *
 * Integration tests for credit RPC functions:
 * - get_credit_balance: Returns current credit balance
 * - reserve_credits: Reserves credits for a job
 * - finalize_job_credits: Finalizes credits after job completion
 * - release_job_credits: Releases reserved credits on job failure
 */

import { createClient } from '@supabase/supabase-js';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';

// Supabase test client setup
const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

describe('TEST-004: Credit Functions Integration Tests', () => {
  let testUserId: string;
  let testProjectId: string;
  const testUserEmail = `credit-test-${Date.now()}@example.com`;

  // Helper function to create a test job
  async function createTestJob(jobId?: string): Promise<string> {
    const id = jobId || randomUUID();

    const { error } = await supabase.from('jobs').insert({
      id,
      project_id: testProjectId,
      user_id: testUserId,
      status: 'QUEUED',
      progress: 0,
    });

    if (error) {
      throw new Error(`Failed to create test job: ${error.message}`);
    }

    return id;
  }

  beforeAll(async () => {
    // Create a test user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testUserEmail,
      email_confirm: true,
      user_metadata: {
        full_name: 'Credit Test User',
      },
    });

    expect(authError).toBeNull();
    expect(authData.user).toBeDefined();
    testUserId = authData.user!.id;

    // Wait for trigger to create profile and grant trial credits
    await new Promise(resolve => setTimeout(resolve, 200));

    // Create a test project for jobs
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .insert({
        user_id: testUserId,
        title: 'Test Project for Credits',
        prompt_text: 'Test prompt for credit tests',
        niche_preset: 'motivation',
        target_minutes: 1,
        status: 'generating',
      })
      .select()
      .single();

    expect(projectError).toBeNull();
    testProjectId = projectData!.id;
  });

  afterAll(async () => {
    // Clean up test user (cascades to projects and jobs)
    if (testUserId) {
      await supabase.auth.admin.deleteUser(testUserId);
    }
  });

  describe('DB-010: get_credit_balance', () => {
    it('should return correct balance after trial credits', async () => {
      const { data, error } = await supabase.rpc('get_credit_balance', {
        p_user_id: testUserId,
      });

      expect(error).toBeNull();
      expect(data).toBe(10); // Trial credits
    });

    it('should return 0 for user with no transactions', async () => {
      const fakeUserId = randomUUID();
      const { data, error } = await supabase.rpc('get_credit_balance', {
        p_user_id: fakeUserId,
      });

      expect(error).toBeNull();
      expect(data).toBe(0);
    });

    it('should calculate balance correctly after multiple transactions', async () => {
      // Add some credits manually
      await supabase.from('credit_ledger').insert({
        user_id: testUserId,
        type: 'purchase',
        amount: 50,
        note: 'Test purchase',
      });

      const { data, error } = await supabase.rpc('get_credit_balance', {
        p_user_id: testUserId,
      });

      expect(error).toBeNull();
      expect(data).toBe(60); // 10 trial + 50 purchase
    });
  });

  describe('DB-011: reserve_credits', () => {
    it('should successfully reserve credits when sufficient balance exists', async () => {
      const jobId = await createTestJob();

      const { data, error } = await supabase.rpc('reserve_credits', {
        p_user_id: testUserId,
        p_job_id: jobId,
        p_amount: 5,
      });

      expect(error).toBeNull();
      expect(data).toBe(true);

      // Verify the transaction was created
      const { data: ledgerData } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('job_id', jobId)
        .eq('type', 'reserve')
        .single();

      expect(ledgerData).toBeDefined();
      expect(ledgerData!.amount).toBe(-5);
      expect(ledgerData!.user_id).toBe(testUserId);
      expect(ledgerData!.note).toBe('Reserved for job');
    });

    it('should return false when insufficient balance', async () => {
      const newJobId = await createTestJob();

      // Try to reserve more than available balance
      const { data, error } = await supabase.rpc('reserve_credits', {
        p_user_id: testUserId,
        p_job_id: newJobId,
        p_amount: 1000,
      });

      expect(error).toBeNull();
      expect(data).toBe(false);

      // Verify no transaction was created
      const { data: ledgerData } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('job_id', newJobId);

      expect(ledgerData).toEqual([]);
    });

    it('should correctly decrease available balance after reservation', async () => {
      const balanceBefore = await supabase.rpc('get_credit_balance', {
        p_user_id: testUserId,
      });

      const newJobId = await createTestJob();
      await supabase.rpc('reserve_credits', {
        p_user_id: testUserId,
        p_job_id: newJobId,
        p_amount: 10,
      });

      const balanceAfter = await supabase.rpc('get_credit_balance', {
        p_user_id: testUserId,
      });

      expect(balanceAfter.data).toBe(balanceBefore.data! - 10);
    });
  });

  describe('DB-012: finalize_job_credits', () => {
    it('should convert reserve to usage when final cost equals reserved', async () => {
      const jobId = await createTestJob();

      // Reserve 10 credits
      await supabase.rpc('reserve_credits', {
        p_user_id: testUserId,
        p_job_id: jobId,
        p_amount: 10,
      });

      // Finalize with same amount
      const { error } = await supabase.rpc('finalize_job_credits', {
        p_user_id: testUserId,
        p_job_id: jobId,
        p_final_cost: 10,
      });

      expect(error).toBeNull();

      // Verify the transaction type changed from 'reserve' to 'usage'
      const { data: reserveData } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('job_id', jobId)
        .eq('type', 'reserve');

      expect(reserveData).toEqual([]);

      const { data: usageData } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('job_id', jobId)
        .eq('type', 'usage')
        .single();

      expect(usageData).toBeDefined();
      expect(usageData!.amount).toBe(-10);
      expect(usageData!.note).toBe('Video generation completed');
    });

    it('should refund difference when final cost is less than reserved', async () => {
      const jobId = await createTestJob();

      // Reserve 15 credits
      await supabase.rpc('reserve_credits', {
        p_user_id: testUserId,
        p_job_id: jobId,
        p_amount: 15,
      });

      // Finalize with only 10 credits used
      const { error } = await supabase.rpc('finalize_job_credits', {
        p_user_id: testUserId,
        p_job_id: jobId,
        p_final_cost: 10,
      });

      expect(error).toBeNull();

      // Check for refund transaction
      const { data: refundData } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('job_id', jobId)
        .eq('type', 'refund')
        .single();

      expect(refundData).toBeDefined();
      expect(refundData!.amount).toBe(5); // 15 - 10 = 5 refunded
      expect(refundData!.note).toContain('Partial refund');

      // Verify usage transaction exists
      const { data: usageData } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('job_id', jobId)
        .eq('type', 'usage')
        .single();

      expect(usageData).toBeDefined();
      expect(usageData!.amount).toBe(-15);
    });

    it('should handle finalization when no reservation exists', async () => {
      const jobId = randomUUID();

      // Try to finalize without reservation
      const { error } = await supabase.rpc('finalize_job_credits', {
        p_user_id: testUserId,
        p_job_id: jobId,
        p_final_cost: 10,
      });

      // Should not error, just do nothing
      expect(error).toBeNull();

      // Verify no transactions created
      const { data: ledgerData } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('job_id', jobId);

      expect(ledgerData).toEqual([]);
    });

    it('should maintain correct balance after finalization with refund', async () => {
      const balanceBefore = await supabase.rpc('get_credit_balance', {
        p_user_id: testUserId,
      });

      const jobId = await createTestJob();

      // Reserve 20 credits
      await supabase.rpc('reserve_credits', {
        p_user_id: testUserId,
        p_job_id: jobId,
        p_amount: 20,
      });

      // Finalize with only 12 used (8 should be refunded)
      await supabase.rpc('finalize_job_credits', {
        p_user_id: testUserId,
        p_job_id: jobId,
        p_final_cost: 12,
      });

      const balanceAfter = await supabase.rpc('get_credit_balance', {
        p_user_id: testUserId,
      });

      // Balance should be: before - 12 (net cost after refund)
      expect(balanceAfter.data).toBe(balanceBefore.data! - 12);
    });
  });

  describe('DB-013: release_job_credits', () => {
    it('should release reserved credits on job failure', async () => {
      const jobId = await createTestJob();

      // Get balance before reservation
      const balanceBefore = await supabase.rpc('get_credit_balance', {
        p_user_id: testUserId,
      });

      // Reserve 10 credits
      await supabase.rpc('reserve_credits', {
        p_user_id: testUserId,
        p_job_id: jobId,
        p_amount: 10,
      });

      // Verify balance decreased
      const balanceAfterReserve = await supabase.rpc('get_credit_balance', {
        p_user_id: testUserId,
      });
      expect(balanceAfterReserve.data).toBe(balanceBefore.data! - 10);

      // Release the credits
      const { error } = await supabase.rpc('release_job_credits', {
        p_job_id: jobId,
      });

      expect(error).toBeNull();

      // Verify no reserve transaction exists (it was deleted)
      const { data: reserveData } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('job_id', jobId)
        .eq('type', 'reserve');

      expect(reserveData).toEqual([]);

      // Verify no other transactions were created for this job
      const { data: allJobTransactions } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('job_id', jobId);

      expect(allJobTransactions).toEqual([]); // All transactions for this job deleted

      // Verify balance restored to original (before reservation)
      const balanceAfter = await supabase.rpc('get_credit_balance', {
        p_user_id: testUserId,
      });

      expect(balanceAfter.data).toBe(balanceBefore.data);
    });

    it('should handle release when no reservation exists', async () => {
      const jobId = randomUUID();

      const { error } = await supabase.rpc('release_job_credits', {
        p_job_id: jobId,
      });

      // Should not error, just do nothing
      expect(error).toBeNull();

      // Verify no transactions created
      const { data: ledgerData } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('job_id', jobId);

      expect(ledgerData).toEqual([]);
    });

    it('should delete reserve transaction on release', async () => {
      const jobId = await createTestJob();

      const balanceBefore = await supabase.rpc('get_credit_balance', {
        p_user_id: testUserId,
      });

      // Reserve credits
      await supabase.rpc('reserve_credits', {
        p_user_id: testUserId,
        p_job_id: jobId,
        p_amount: 7,
      });

      // Get the reserve transaction
      const { data: reserveBefore } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('job_id', jobId)
        .eq('type', 'reserve')
        .single();

      expect(reserveBefore!.amount).toBe(-7);

      // Release
      await supabase.rpc('release_job_credits', {
        p_job_id: jobId,
      });

      // Verify the reserve transaction was deleted
      const { data: transactionsAfter } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('job_id', jobId);

      expect(transactionsAfter).toEqual([]); // No transactions for this job

      // Verify balance restored
      const balanceAfter = await supabase.rpc('get_credit_balance', {
        p_user_id: testUserId,
      });

      expect(balanceAfter.data).toBe(balanceBefore.data);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle concurrent reservations correctly', async () => {
      // Add known balance
      await supabase.from('credit_ledger').insert({
        user_id: testUserId,
        type: 'purchase',
        amount: 100,
        note: 'Setup for concurrent test',
      });

      const jobId1 = await createTestJob();
      const jobId2 = await createTestJob();

      // Try to reserve simultaneously
      const [result1, result2] = await Promise.all([
        supabase.rpc('reserve_credits', {
          p_user_id: testUserId,
          p_job_id: jobId1,
          p_amount: 50,
        }),
        supabase.rpc('reserve_credits', {
          p_user_id: testUserId,
          p_job_id: jobId2,
          p_amount: 50,
        }),
      ]);

      // Both should succeed given sufficient balance
      expect(result1.data).toBe(true);
      expect(result2.data).toBe(true);
    });

    it('should prevent negative balance through reservations', async () => {
      const currentBalance = await supabase.rpc('get_credit_balance', {
        p_user_id: testUserId,
      });

      const jobId = await createTestJob();

      // Try to reserve more than available
      const { data } = await supabase.rpc('reserve_credits', {
        p_user_id: testUserId,
        p_job_id: jobId,
        p_amount: currentBalance.data! + 100,
      });

      expect(data).toBe(false);

      // Balance should remain unchanged
      const balanceAfter = await supabase.rpc('get_credit_balance', {
        p_user_id: testUserId,
      });

      expect(balanceAfter.data).toBe(currentBalance.data);
    });
  });
});
