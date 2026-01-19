/**
 * useCredits Hook - UI-015
 *
 * Fetches credit balance via RPC and handles loading state
 *
 * Features:
 * - Fetches credit balance via get_credit_balance RPC function
 * - Handles loading state during fetch
 * - Handles error states gracefully
 * - Returns balance of 0 for unauthenticated users
 *
 * @returns {Object} Credit state
 * @returns {number} balance - Current credit balance
 * @returns {boolean} isLoading - True during fetch
 * @returns {string | undefined} error - Error message if fetch failed
 *
 * @example
 * ```tsx
 * function CreditDisplay() {
 *   const { balance, isLoading, error } = useCredits();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error}</div>;
 *
 *   return <div>Credits: {balance}</div>;
 * }
 * ```
 */

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface UseCreditsResult {
  balance: number;
  isLoading: boolean;
  error?: string;
}

export function useCredits(): UseCreditsResult {
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    async function fetchBalance() {
      try {
        setIsLoading(true);
        const supabase = createClient();

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setBalance(0);
          setIsLoading(false);
          return;
        }

        // Call RPC function to get credit balance
        // Note: Parameter name must match the RPC function signature: p_user_id
        const { data, error: rpcError } = await supabase
          .rpc('get_credit_balance', { p_user_id: user.id });

        if (rpcError) {
          throw rpcError;
        }

        setBalance(data || 0);
        setError(undefined);
      } catch (err) {
        console.error('Failed to fetch credit balance:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch credits');
        setBalance(0);
      } finally {
        setIsLoading(false);
      }
    }

    fetchBalance();
  }, []);

  return { balance, isLoading, error };
}
