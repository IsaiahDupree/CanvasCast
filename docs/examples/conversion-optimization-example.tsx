/**
 * Conversion Optimization Usage Examples (META-008)
 *
 * Demonstrates how to use conversion optimization features in CanvasCast
 * to maximize Meta ad campaign performance.
 */

import { trackEventDual } from '@/lib/analytics';
import {
  getConversionValue,
  calculatePredictedLTV,
  getOptimizationParams,
  formatForValueOptimization,
  ConversionEvent,
  OptimizationGoal,
} from '@/lib/conversion-optimization';

// ============================================================================
// Example 1: Purchase Event with Value Optimization
// ============================================================================

export async function handleCreditPurchase(credits: number, amount: number) {
  // Get optimized conversion value
  const conversionValue = getConversionValue(ConversionEvent.PURCHASE, {
    amount, // in cents
    credits,
  });

  // Track to both PostHog and Meta Pixel with value
  trackEventDual('purchase_completed', {
    amount,
    credits,
    product_type: 'credits',
    // Add conversion value for Meta optimization
    value: conversionValue.value,
    currency: conversionValue.currency,
    num_items: conversionValue.numItems,
  });

  console.log('Purchase tracked with value:', conversionValue);
  // {
  //   value: 29.99,
  //   currency: 'USD',
  //   numItems: 100
  // }
}

// ============================================================================
// Example 2: Subscription with Predicted LTV
// ============================================================================

export async function handleSubscriptionStart(
  plan: 'starter' | 'creator' | 'pro',
  amount: number
) {
  // Get subscription value with predicted LTV
  const conversionValue = getConversionValue(ConversionEvent.SUBSCRIPTION, {
    amount,
    plan,
  });

  // Track with predicted LTV for better optimization
  trackEventDual('subscription_started', {
    amount,
    plan,
    // Value optimization fields
    value: conversionValue.value,
    currency: conversionValue.currency,
    predicted_ltv: conversionValue.predictedLtv, // 6-month prediction
  });

  console.log('Subscription tracked with LTV:', {
    monthlyValue: conversionValue.value,
    predictedLTV: conversionValue.predictedLtv,
  });
  // {
  //   monthlyValue: 49.00,
  //   predictedLTV: 294.00 (6 months)
  // }
}

// ============================================================================
// Example 3: Complex LTV Calculation
// ============================================================================

export function calculateCustomerLTV(userData: {
  monthlySpend: number;
  initialPurchase: number;
  cohortRetentionRate: number;
}) {
  const ltv = calculatePredictedLTV({
    currentMonthlyValue: userData.monthlySpend,
    oneTimePurchaseValue: userData.initialPurchase,
    retentionMonths: 12, // 1 year
    retentionRate: userData.cohortRetentionRate,
    upsellProbability: 0.3, // 30% upgrade to higher plan
    expectedUpsellValue: 100, // Additional $100 from upgrade
  });

  return ltv;
}

// Usage
const customerLTV = calculateCustomerLTV({
  monthlySpend: 49.00,
  initialPurchase: 29.00,
  cohortRetentionRate: 0.75,
});
console.log('Customer LTV:', customerLTV); // $470 + $30 = $500

// ============================================================================
// Example 4: Video Engagement Tracking
// ============================================================================

export function trackVideoActions(videoId: string, projectId: string) {
  // Video generated - $5 engagement value
  const generatedValue = getConversionValue(ConversionEvent.VIDEO_GENERATED, {
    projectId,
  });

  trackEventDual('video_generated', {
    video_id: videoId,
    project_id: projectId,
    value: generatedValue.value, // $5.00
    content_type: generatedValue.contentType,
  });

  // Video downloaded - $2 high-intent value
  const downloadValue = getConversionValue(ConversionEvent.VIDEO_DOWNLOADED, {
    videoId,
  });

  trackEventDual('video_downloaded', {
    video_id: videoId,
    value: downloadValue.value, // $2.00
    content_type: downloadValue.contentType,
  });
}

// ============================================================================
// Example 5: Checkout Flow with Value
// ============================================================================

export async function initiateCheckout(
  productType: 'credits' | 'subscription',
  amount: number,
  credits?: number
) {
  // Track checkout initiation with value
  const conversionValue = getConversionValue(ConversionEvent.CHECKOUT_STARTED, {
    amount,
    credits,
  });

  trackEventDual('checkout_started', {
    product_type: productType,
    amount,
    credits,
    // Optimization fields
    value: conversionValue.value,
    currency: conversionValue.currency,
    num_items: conversionValue.numItems,
  });

  // Create Stripe checkout session
  const session = await fetch('/api/v1/credits/purchase', {
    method: 'POST',
    body: JSON.stringify({ amount, credits }),
  });

  return session;
}

// ============================================================================
// Example 6: Format Helper for Value Optimization
// ============================================================================

export function trackWithAutoFormatting(
  event: ConversionEvent,
  properties: Record<string, any>
) {
  // Automatically format for value optimization
  const formatted = formatForValueOptimization(event, properties);

  // The formatted object is ready for Meta Pixel
  console.log('Formatted for Meta:', formatted);
  // {
  //   value: 29.99,
  //   currency: 'USD',
  //   num_items: 100
  // }

  // Track with formatted values
  trackEventDual(event, {
    ...properties,
    ...formatted,
  });
}

// ============================================================================
// Example 7: Campaign Optimization Parameters
// ============================================================================

export function getCampaignSettings() {
  // Value-based optimization (for purchases/subscriptions)
  const valueParams = getOptimizationParams(OptimizationGoal.VALUE);
  console.log('Value campaign settings:', valueParams);
  // {
  //   optimizationGoal: 'VALUE',
  //   bidStrategy: 'LOWEST_COST_WITH_BID_CAP',
  //   conversionWindow: 7,
  //   attributionSetting: 'DEFAULT'
  // }

  // Conversion optimization (for signups/leads)
  const conversionParams = getOptimizationParams(OptimizationGoal.CONVERSIONS, {
    conversionWindow: 28,
    attributionSetting: '7_DAY_CLICK_1_DAY_VIEW',
  });
  console.log('Conversion campaign settings:', conversionParams);

  // Reach optimization (for awareness)
  const reachParams = getOptimizationParams(OptimizationGoal.REACH);
  console.log('Reach campaign settings:', reachParams);
}

// ============================================================================
// Example 8: React Component with Value Tracking
// ============================================================================

'use client';

import { useState } from 'react';

export function PricingCard({
  plan,
  amount,
  credits,
}: {
  plan: string;
  amount: number;
  credits: number;
}) {
  const [loading, setLoading] = useState(false);

  const handlePurchase = async () => {
    setLoading(true);

    try {
      // Get conversion value for this purchase
      const conversionValue = getConversionValue(ConversionEvent.PURCHASE, {
        amount,
        credits,
      });

      // Track checkout started with value
      trackEventDual('checkout_started', {
        plan,
        amount,
        credits,
        value: conversionValue.value,
        currency: conversionValue.currency,
        num_items: conversionValue.numItems,
      });

      // Proceed to checkout
      const response = await fetch('/api/v1/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, amount, credits }),
      });

      const { checkoutUrl } = await response.json();
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Checkout failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border rounded-lg p-6">
      <h3 className="text-xl font-bold">{plan}</h3>
      <p className="text-3xl font-bold">${amount / 100}</p>
      <p className="text-gray-600">{credits} credits</p>
      <button
        onClick={handlePurchase}
        disabled={loading}
        className="mt-4 w-full bg-blue-600 text-white py-2 rounded"
      >
        {loading ? 'Processing...' : 'Buy Now'}
      </button>
    </div>
  );
}

// ============================================================================
// Example 9: Server-Side Purchase Confirmation
// ============================================================================

// In Stripe webhook handler
export async function handleStripeCheckoutCompleted(session: any) {
  const { metadata } = session;
  const { userId, credits, amount } = metadata;

  // Get conversion value
  const conversionValue = getConversionValue(ConversionEvent.PURCHASE, {
    amount: parseInt(amount),
    credits: parseInt(credits),
  });

  // Track purchase completion
  // (In real implementation, you'd also send to CAPI for deduplication)
  trackEventDual('purchase_completed', {
    user_id: userId,
    amount: parseInt(amount),
    credits: parseInt(credits),
    transaction_id: session.id,
    // Value optimization
    value: conversionValue.value,
    currency: conversionValue.currency,
    num_items: conversionValue.numItems,
  });

  // Grant credits to user
  // await grantCredits(userId, credits);
}

// ============================================================================
// Example 10: A/B Testing Value vs. Conversion Optimization
// ============================================================================

export function setupCampaignABTest() {
  // Campaign A: Value Optimization
  const campaignA = {
    name: 'Purchase Campaign - Value Optimization',
    ...getOptimizationParams(OptimizationGoal.VALUE),
    targetEvent: 'purchase_completed',
    includeValue: true,
    includePredictedLTV: true,
  };

  // Campaign B: Conversion Optimization
  const campaignB = {
    name: 'Purchase Campaign - Conversion Optimization',
    ...getOptimizationParams(OptimizationGoal.CONVERSIONS),
    targetEvent: 'purchase_completed',
    includeValue: false,
    includePredictedLTV: false,
  };

  console.log('A/B Test Setup:', {
    campaignA,
    campaignB,
    recommendation:
      'Run for at least 50 conversions per campaign to reach statistical significance',
  });

  return { campaignA, campaignB };
}
