/**
 * RATE-003: Job Creation Rate Limit - Tier Detection
 *
 * Determines the appropriate rate limit tier for a user based on their
 * subscription status, credit balance, and purchase history.
 */

import { JOB_CREATION_RATE_LIMITS, type RateLimitTier } from '@canvascast/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Get the rate limit tier for a user
 *
 * Tier determination logic:
 * 1. Check for active subscription -> use subscription tier
 * 2. Check total credits purchased -> infer tier from purchase volume
 * 3. Default to 'free' tier for trial users
 */
export async function getUserRateLimitTier(
  supabase: SupabaseClient,
  userId: string
): Promise<RateLimitTier> {
  try {
    // Check for active subscription
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (subscription?.plan) {
      return mapPlanToTier(subscription.plan);
    }

    // Check credit purchase history to infer tier
    const { data: purchases } = await supabase
      .from('credit_ledger')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', 'purchase')
      .order('created_at', { ascending: false })
      .limit(1);

    if (purchases && purchases.length > 0) {
      const lastPurchaseAmount = purchases[0].amount;
      return mapCreditPurchaseToTier(lastPurchaseAmount);
    }

    // Default to free tier
    return 'free';
  } catch (error) {
    console.error('[RATE-LIMIT] Error determining user tier:', error);
    // Fail safe: return free tier on error
    return 'free';
  }
}

/**
 * Map subscription plan name to rate limit tier
 */
function mapPlanToTier(plan: string): RateLimitTier {
  const planLower = plan.toLowerCase();

  if (planLower.includes('creator') || planLower.includes('plus') || planLower.includes('business')) {
    return 'creator_plus';
  }

  if (planLower.includes('pro')) {
    return 'pro';
  }

  if (planLower.includes('starter') || planLower.includes('hobbyist')) {
    return 'starter';
  }

  return 'free';
}

/**
 * Map credit purchase amount to rate limit tier
 *
 * Based on typical credit pack sizes:
 * - 25-50 credits: starter
 * - 80-250 credits: pro
 * - 500+ credits: creator_plus
 */
function mapCreditPurchaseToTier(creditAmount: number): RateLimitTier {
  if (creditAmount >= 500) {
    return 'creator_plus';
  }

  if (creditAmount >= 80) {
    return 'pro';
  }

  if (creditAmount >= 25) {
    return 'starter';
  }

  return 'free';
}

/**
 * Get rate limit configuration for a user
 */
export async function getUserRateLimitConfig(
  supabase: SupabaseClient,
  userId: string
) {
  const tier = await getUserRateLimitTier(supabase, userId);
  const config = JOB_CREATION_RATE_LIMITS[tier];

  return {
    tier,
    ...config,
    prefix: 'ratelimit:job-creation',
  };
}
