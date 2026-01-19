/**
 * Credit Balance RPC Function Tests
 * Feature: DB-010 - Credit Balance RPC Function
 *
 * Tests the get_credit_balance RPC function which:
 * - Returns the current credit balance for a user
 * - Handles null case (returns 0 if no transactions)
 * - Correctly sums all credit transactions
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
let OTHER_USER_ID: string;

describe('DB-010: get_credit_balance RPC Function', () => {
  beforeAll(async () => {
    // Create test users in auth.users
    const { data: user1, error: error1 } = await supabase.auth.admin.createUser({
      email: 'test-credit-balance@example.com',
      password: 'test123456',
      email_confirm: true,
    });

    const { data: user2, error: error2 } = await supabase.auth.admin.createUser({
      email: 'test-credit-balance-other@example.com',
      password: 'test123456',
      email_confirm: true,
    });

    if (!user1?.user || !user2?.user) {
      throw new Error('Failed to create test users');
    }

    TEST_USER_ID = user1.user.id;
    OTHER_USER_ID = user2.user.id;

    // Clean up any existing test data
    await supabase
      .from('credit_ledger')
      .delete()
      .in('user_id', [TEST_USER_ID, OTHER_USER_ID]);
  });

  afterAll(async () => {
    // Clean up test data
    await supabase
      .from('credit_ledger')
      .delete()
      .in('user_id', [TEST_USER_ID, OTHER_USER_ID]);

    // Delete test users
    if (TEST_USER_ID) {
      await supabase.auth.admin.deleteUser(TEST_USER_ID);
    }
    if (OTHER_USER_ID) {
      await supabase.auth.admin.deleteUser(OTHER_USER_ID);
    }
  });

  describe('Function Existence', () => {
    it('should have get_credit_balance RPC function defined', async () => {
      // Try to call the function - it should exist even if it returns an error
      const { data, error } = await supabase.rpc('get_credit_balance', {
        p_user_id: TEST_USER_ID,
      });

      // Function should exist (even if there's no data, it shouldn't fail with "function does not exist")
      if (error) {
        expect(error.message).not.toContain('function');
        expect(error.message).not.toContain('does not exist');
      }
    });
  });

  describe('Null Case Handling', () => {
    it('should return 0 for user with no transactions', async () => {
      // Ensure user has no transactions
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      const { data, error } = await supabase.rpc('get_credit_balance', {
        p_user_id: TEST_USER_ID,
      });

      expect(error).toBeNull();
      expect(data).toBe(0);
    });

    it('should return 0 for non-existent user', async () => {
      const nonExistentUserId = '99999999-9999-9999-9999-999999999999';

      const { data, error } = await supabase.rpc('get_credit_balance', {
        p_user_id: nonExistentUserId,
      });

      expect(error).toBeNull();
      expect(data).toBe(0);
    });
  });

  describe('Balance Calculation', () => {
    it('should return correct balance after single purchase', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Add a purchase
      await supabase.from('credit_ledger').insert({
        user_id: TEST_USER_ID,
        type: 'purchase',
        amount: 50,
        note: 'Test purchase',
      });

      const { data, error } = await supabase.rpc('get_credit_balance', {
        p_user_id: TEST_USER_ID,
      });

      expect(error).toBeNull();
      expect(data).toBe(50);
    });

    it('should correctly sum multiple positive transactions', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Add multiple purchases
      await supabase.from('credit_ledger').insert([
        {
          user_id: TEST_USER_ID,
          type: 'purchase',
          amount: 50,
          note: 'First purchase',
        },
        {
          user_id: TEST_USER_ID,
          type: 'grant',
          amount: 10,
          note: 'Welcome bonus',
        },
        {
          user_id: TEST_USER_ID,
          type: 'purchase',
          amount: 30,
          note: 'Second purchase',
        },
      ]);

      const { data, error } = await supabase.rpc('get_credit_balance', {
        p_user_id: TEST_USER_ID,
      });

      expect(error).toBeNull();
      expect(data).toBe(90); // 50 + 10 + 30
    });

    it('should correctly handle negative amounts (usage)', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Add credits then use some
      await supabase.from('credit_ledger').insert([
        {
          user_id: TEST_USER_ID,
          type: 'purchase',
          amount: 100,
          note: 'Purchase',
        },
        {
          user_id: TEST_USER_ID,
          type: 'reserve',
          amount: -10,
          note: 'Reserved for job',
        },
      ]);

      const { data, error } = await supabase.rpc('get_credit_balance', {
        p_user_id: TEST_USER_ID,
      });

      expect(error).toBeNull();
      expect(data).toBe(90); // 100 - 10
    });

    it('should handle mixed positive and negative transactions', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Complex scenario: purchase, usage, refund
      await supabase.from('credit_ledger').insert([
        {
          user_id: TEST_USER_ID,
          type: 'grant',
          amount: 10,
          note: 'Trial credits',
        },
        {
          user_id: TEST_USER_ID,
          type: 'purchase',
          amount: 50,
          note: 'Purchase credits',
        },
        {
          user_id: TEST_USER_ID,
          type: 'reserve',
          amount: -15,
          note: 'Reserved for job',
        },
        {
          user_id: TEST_USER_ID,
          type: 'refund',
          amount: 5,
          note: 'Partial refund',
        },
        {
          user_id: TEST_USER_ID,
          type: 'reserve',
          amount: -20,
          note: 'Another job',
        },
      ]);

      const { data, error } = await supabase.rpc('get_credit_balance', {
        p_user_id: TEST_USER_ID,
      });

      expect(error).toBeNull();
      expect(data).toBe(30); // 10 + 50 - 15 + 5 - 20
    });

    it('should return correct balance even with zero balance', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Add and use exact same amount
      await supabase.from('credit_ledger').insert([
        {
          user_id: TEST_USER_ID,
          type: 'purchase',
          amount: 50,
          note: 'Purchase',
        },
        {
          user_id: TEST_USER_ID,
          type: 'reserve',
          amount: -50,
          note: 'Use all credits',
        },
      ]);

      const { data, error } = await supabase.rpc('get_credit_balance', {
        p_user_id: TEST_USER_ID,
      });

      expect(error).toBeNull();
      expect(data).toBe(0);
    });

    it('should allow negative balance (overdraft scenario)', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Use more than you have (edge case)
      await supabase.from('credit_ledger').insert([
        {
          user_id: TEST_USER_ID,
          type: 'purchase',
          amount: 10,
          note: 'Small purchase',
        },
        {
          user_id: TEST_USER_ID,
          type: 'reserve',
          amount: -20,
          note: 'Overdraft',
        },
      ]);

      const { data, error } = await supabase.rpc('get_credit_balance', {
        p_user_id: TEST_USER_ID,
      });

      expect(error).toBeNull();
      expect(data).toBe(-10); // Should handle negative balance
    });
  });

  describe('Function Signature', () => {
    it('should accept user_id parameter', async () => {
      const { error } = await supabase.rpc('get_credit_balance', {
        p_user_id: TEST_USER_ID,
      });

      // Should not error on parameter acceptance
      expect(error).toBeNull();
    });

    it('should return INTEGER type', async () => {
      // Ensure user has no transactions
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      const { data } = await supabase.rpc('get_credit_balance', {
        p_user_id: TEST_USER_ID,
      });

      expect(typeof data).toBe('number');
      expect(Number.isInteger(data)).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should handle user with many transactions', async () => {
      // Clean slate
      await supabase
        .from('credit_ledger')
        .delete()
        .eq('user_id', TEST_USER_ID);

      // Insert many transactions
      const transactions = Array.from({ length: 100 }, (_, i) => ({
        user_id: TEST_USER_ID,
        type: i % 2 === 0 ? 'purchase' : 'reserve',
        amount: i % 2 === 0 ? 10 : -5,
        note: `Transaction ${i}`,
      }));

      await supabase.from('credit_ledger').insert(transactions);

      const startTime = Date.now();
      const { data, error } = await supabase.rpc('get_credit_balance', {
        p_user_id: TEST_USER_ID,
      });
      const duration = Date.now() - startTime;

      expect(error).toBeNull();
      expect(data).toBe(250); // 50 * 10 - 50 * 5 = 500 - 250 = 250
      expect(duration).toBeLessThan(1000); // Should be fast
    });
  });

  describe('Isolation', () => {
    it('should only return balance for specified user', async () => {
      // Clean slate for both users
      await supabase
        .from('credit_ledger')
        .delete()
        .in('user_id', [TEST_USER_ID, OTHER_USER_ID]);

      // Add credits to both users
      await supabase.from('credit_ledger').insert([
        {
          user_id: TEST_USER_ID,
          type: 'purchase',
          amount: 100,
          note: 'Test user credits',
        },
        {
          user_id: OTHER_USER_ID,
          type: 'purchase',
          amount: 200,
          note: 'Other user credits',
        },
      ]);

      // Get balance for TEST_USER_ID
      const { data: testUserBalance } = await supabase.rpc('get_credit_balance', {
        p_user_id: TEST_USER_ID,
      });

      // Get balance for OTHER_USER_ID
      const { data: otherUserBalance } = await supabase.rpc('get_credit_balance', {
        p_user_id: OTHER_USER_ID,
      });

      expect(testUserBalance).toBe(100);
      expect(otherUserBalance).toBe(200);

      // Clean up both users
      await supabase
        .from('credit_ledger')
        .delete()
        .in('user_id', [TEST_USER_ID, OTHER_USER_ID]);
    });
  });
});
