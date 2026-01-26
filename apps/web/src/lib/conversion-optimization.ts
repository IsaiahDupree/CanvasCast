/**
 * Meta Conversion Optimization (META-008)
 *
 * Provides utilities for optimizing Meta ad campaigns based on conversion value,
 * predicted lifetime value (LTV), and conversion parameters.
 *
 * Features:
 * - Predictive LTV calculations for subscriptions
 * - Conversion value helpers for different event types
 * - Campaign optimization parameter configuration
 * - Value-based bidding support
 *
 * Usage:
 * ```typescript
 * import { getConversionValue, ConversionEvent } from '@/lib/conversion-optimization';
 *
 * // Get conversion value for purchase
 * const value = getConversionValue(ConversionEvent.PURCHASE, {
 *   amount: 2999,
 *   credits: 100,
 * });
 *
 * // Track with Meta Pixel
 * trackMetaEvent('Purchase', {
 *   value: value.value,
 *   currency: value.currency,
 *   num_items: value.numItems,
 * });
 * ```
 */

/**
 * Conversion events supported by the optimization system
 */
export enum ConversionEvent {
  SIGNUP_COMPLETED = 'signup_completed',
  VIDEO_GENERATED = 'video_generated',
  VIDEO_DOWNLOADED = 'video_downloaded',
  CHECKOUT_STARTED = 'checkout_started',
  PURCHASE = 'purchase_completed',
  SUBSCRIPTION = 'subscription_started',
}

/**
 * Optimization goals for Meta campaigns
 */
export enum OptimizationGoal {
  VALUE = 'VALUE',
  CONVERSIONS = 'CONVERSIONS',
  REACH = 'REACH',
  ENGAGEMENT = 'ENGAGEMENT',
}

/**
 * Parameters for calculating predicted LTV
 */
export interface LTVCalculationParams {
  /** Monthly recurring value (in dollars) */
  currentMonthlyValue: number;
  /** Expected retention period in months */
  retentionMonths: number;
  /** One-time purchase value (in dollars) */
  oneTimePurchaseValue?: number;
  /** Retention rate (0-1), defaults to 1.0 */
  retentionRate?: number;
  /** Probability of upsell (0-1) */
  upsellProbability?: number;
  /** Expected upsell value if it occurs (in dollars) */
  expectedUpsellValue?: number;
}

/**
 * Conversion value result
 */
export interface ConversionValue {
  value: number;
  currency: string;
  predictedLtv?: number;
  numItems?: number;
  contentType?: string;
  status?: string;
}

/**
 * Campaign optimization parameters
 */
export interface OptimizationParams {
  optimizationGoal: string;
  bidStrategy: string;
  conversionWindow: number;
  attributionSetting: string;
}

/**
 * Options for optimization params
 */
export interface OptimizationParamsOptions {
  conversionWindow?: number;
  attributionSetting?: string;
}

/**
 * Calculate predicted lifetime value for a customer
 *
 * Formula:
 * Base LTV = (Monthly Value × Retention Months × Retention Rate) + One-time Value
 * Total LTV = Base LTV + (Upsell Probability × Expected Upsell Value)
 *
 * @param params - LTV calculation parameters
 * @returns Predicted LTV in dollars, rounded to 2 decimal places
 */
export function calculatePredictedLTV(params: LTVCalculationParams): number {
  const {
    currentMonthlyValue,
    retentionMonths,
    oneTimePurchaseValue = 0,
    retentionRate = 1.0,
    upsellProbability = 0,
    expectedUpsellValue = 0,
  } = params;

  // Validate inputs
  if (currentMonthlyValue < 0 || retentionMonths < 0) {
    return 0;
  }

  if (currentMonthlyValue === 0 && oneTimePurchaseValue === 0) {
    return 0;
  }

  // Calculate base LTV
  const recurringValue = currentMonthlyValue * retentionMonths * retentionRate;
  const baseLTV = recurringValue + oneTimePurchaseValue;

  // Calculate expected upsell value
  const upsellValue = upsellProbability * expectedUpsellValue;

  // Total LTV
  const totalLTV = baseLTV + upsellValue;

  // Round to 2 decimal places
  return Math.round(totalLTV * 100) / 100;
}

/**
 * Get conversion value for a specific event type
 *
 * @param event - The conversion event type
 * @param properties - Event properties containing amount, plan, etc.
 * @returns Conversion value with currency and metadata
 */
export function getConversionValue(
  event: ConversionEvent,
  properties: Record<string, any>
): ConversionValue {
  const { amount = 0, credits, plan } = properties;

  // Convert amount from cents to dollars
  const amountInDollars = Math.max(0, amount / 100);

  switch (event) {
    case ConversionEvent.PURCHASE: {
      return {
        value: amountInDollars,
        currency: 'USD',
        numItems: credits || 0,
      };
    }

    case ConversionEvent.SUBSCRIPTION: {
      // Calculate predicted LTV based on plan
      const predictedLtv = calculatePredictedLTV({
        currentMonthlyValue: amountInDollars,
        retentionMonths: 6, // Default 6-month retention
      });

      return {
        value: amountInDollars,
        currency: 'USD',
        predictedLtv,
      };
    }

    case ConversionEvent.CHECKOUT_STARTED: {
      return {
        value: amountInDollars,
        currency: 'USD',
        numItems: credits || 0,
      };
    }

    case ConversionEvent.VIDEO_GENERATED: {
      // Fixed value for video generation (indicates engagement)
      return {
        value: 5.00,
        currency: 'USD',
        contentType: 'video',
      };
    }

    case ConversionEvent.VIDEO_DOWNLOADED: {
      // Downloads indicate high intent - assign engagement value
      return {
        value: 2.00,
        currency: 'USD',
        contentType: 'video',
      };
    }

    case ConversionEvent.SIGNUP_COMPLETED: {
      // No monetary value yet, but important conversion
      return {
        value: 0,
        currency: 'USD',
        status: 'completed',
      };
    }

    default: {
      return {
        value: 0,
        currency: 'USD',
      };
    }
  }
}

/**
 * Get optimization parameters for Meta campaign setup
 *
 * @param goal - The optimization goal
 * @param options - Optional custom settings
 * @returns Campaign optimization parameters
 */
export function getOptimizationParams(
  goal: OptimizationGoal,
  options: OptimizationParamsOptions = {}
): OptimizationParams {
  const {
    conversionWindow = 7,
    attributionSetting = 'DEFAULT',
  } = options;

  switch (goal) {
    case OptimizationGoal.VALUE: {
      return {
        optimizationGoal: 'VALUE',
        bidStrategy: 'LOWEST_COST_WITH_BID_CAP',
        conversionWindow,
        attributionSetting,
      };
    }

    case OptimizationGoal.CONVERSIONS: {
      return {
        optimizationGoal: 'OFFSITE_CONVERSIONS',
        bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
        conversionWindow,
        attributionSetting,
      };
    }

    case OptimizationGoal.REACH: {
      return {
        optimizationGoal: 'REACH',
        bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
        conversionWindow: 1,
        attributionSetting,
      };
    }

    case OptimizationGoal.ENGAGEMENT: {
      return {
        optimizationGoal: 'ENGAGEMENT',
        bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
        conversionWindow: 1,
        attributionSetting,
      };
    }

    default: {
      return {
        optimizationGoal: 'OFFSITE_CONVERSIONS',
        bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
        conversionWindow,
        attributionSetting,
      };
    }
  }
}

/**
 * Helper to format event data for value-optimized campaigns
 *
 * @param event - The conversion event
 * @param properties - Event properties
 * @returns Formatted data ready for Meta Pixel tracking
 */
export function formatForValueOptimization(
  event: ConversionEvent,
  properties: Record<string, any>
): Record<string, any> {
  const conversionValue = getConversionValue(event, properties);

  const formatted: Record<string, any> = {
    value: conversionValue.value,
    currency: conversionValue.currency,
  };

  if (conversionValue.predictedLtv !== undefined) {
    formatted.predicted_ltv = conversionValue.predictedLtv;
  }

  if (conversionValue.numItems !== undefined) {
    formatted.num_items = conversionValue.numItems;
  }

  if (conversionValue.contentType !== undefined) {
    formatted.content_type = conversionValue.contentType;
  }

  if (conversionValue.status !== undefined) {
    formatted.status = conversionValue.status;
  }

  return formatted;
}
