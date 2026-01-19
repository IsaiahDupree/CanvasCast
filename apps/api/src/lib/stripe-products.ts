/**
 * Stripe Product Configuration for CanvasCast
 *
 * This module defines credit packs and subscription products for Stripe integration.
 * Credit packs are one-time purchases, while subscriptions provide monthly credits.
 *
 * Pricing model:
 * - 1 credit ≈ 1 minute of video
 * - Larger packs have better per-credit value
 * - Premium niches may have 1.5x multiplier
 */

export interface CreditPack {
  name: string;
  credits: number;
  amount: number; // Price in cents (e.g., 900 = $9.00)
  priceId: string; // Stripe price ID
  description: string;
}

export interface Subscription {
  name: string;
  credits: number;
  amount: number; // Price in cents (e.g., 1900 = $19.00/month)
  priceId: string; // Stripe price ID
  description: string;
  features: string[];
  rolloverLimit?: number; // Max credits that can roll over to next month
}

/**
 * Credit Pack Products (One-Time Purchases)
 *
 * According to PRD:
 * - Starter: 10 credits for $9 ($0.90 per credit)
 * - Creator: 50 credits for $39 ($0.78 per credit)
 * - Pro: 150 credits for $99 ($0.66 per credit)
 */
export const CREDIT_PACKS: Record<string, CreditPack> = {
  starter: {
    name: 'Starter',
    credits: 10,
    amount: 900, // $9.00
    priceId: 'price_starter_10',
    description: 'Perfect for trying out CanvasCast',
  },
  creator: {
    name: 'Creator',
    credits: 50,
    amount: 3900, // $39.00
    priceId: 'price_creator_50',
    description: 'Great for regular content creators',
  },
  pro: {
    name: 'Pro',
    credits: 150,
    amount: 9900, // $99.00
    priceId: 'price_pro_150',
    description: 'Best value for professional creators',
  },
};

/**
 * Subscription Products (Monthly Recurring)
 *
 * According to PRD:
 * - Hobbyist: 30 credits/month for $19 (no rollover)
 * - Creator: 100 credits/month for $49 (50 credit rollover max)
 * - Business: 300 credits/month for $129 (150 credit rollover max)
 */
export const SUBSCRIPTIONS: Record<string, Subscription> = {
  hobbyist: {
    name: 'Hobbyist',
    credits: 30,
    amount: 1900, // $19.00/month
    priceId: 'price_hobbyist_monthly',
    description: 'For casual creators',
    features: [
      '30 credits per month',
      '~30 minutes of video',
      'All standard features',
      'Email support',
    ],
    rolloverLimit: 0, // No rollover
  },
  creator: {
    name: 'Creator',
    credits: 100,
    amount: 4900, // $49.00/month
    priceId: 'price_creator_monthly',
    description: 'For active creators',
    features: [
      '100 credits per month',
      '~100 minutes of video',
      'All premium features',
      'Priority support',
      'Up to 50 credits rollover',
    ],
    rolloverLimit: 50,
  },
  business: {
    name: 'Business',
    credits: 300,
    amount: 12900, // $129.00/month
    priceId: 'price_business_monthly',
    description: 'For teams and agencies',
    features: [
      '300 credits per month',
      '~300 minutes of video',
      'All enterprise features',
      'Priority support',
      'Up to 150 credits rollover',
      'Team collaboration',
      'API access',
    ],
    rolloverLimit: 150,
  },
};

/**
 * Get a credit pack by its ID
 *
 * @param packId - The ID of the credit pack (e.g., 'starter', 'creator', 'pro')
 * @returns The credit pack or undefined if not found
 */
export function getCreditPackById(packId: string): CreditPack | undefined {
  return CREDIT_PACKS[packId];
}

/**
 * Get a subscription by its ID
 *
 * @param subscriptionId - The ID of the subscription (e.g., 'hobbyist', 'creator', 'business')
 * @returns The subscription or undefined if not found
 */
export function getSubscriptionById(subscriptionId: string): Subscription | undefined {
  return SUBSCRIPTIONS[subscriptionId];
}

/**
 * Get credit pack by Stripe price ID
 *
 * @param priceId - The Stripe price ID
 * @returns The credit pack or undefined if not found
 */
export function getCreditPackByPriceId(priceId: string): CreditPack | undefined {
  return Object.values(CREDIT_PACKS).find(pack => pack.priceId === priceId);
}

/**
 * Get subscription by Stripe price ID
 *
 * @param priceId - The Stripe price ID
 * @returns The subscription or undefined if not found
 */
export function getSubscriptionByPriceId(priceId: string): Subscription | undefined {
  return Object.values(SUBSCRIPTIONS).find(sub => sub.priceId === priceId);
}

/**
 * Validate credit pack pricing configuration
 *
 * @returns Validation result with any errors found
 */
export function validateCreditPackPricing(): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  Object.entries(CREDIT_PACKS).forEach(([id, pack]) => {
    if (pack.credits <= 0) {
      errors.push(`Credit pack "${id}" has invalid credits: ${pack.credits}`);
    }
    if (pack.amount <= 0) {
      errors.push(`Credit pack "${id}" has invalid amount: ${pack.amount}`);
    }
    if (!pack.priceId || pack.priceId.length === 0) {
      errors.push(`Credit pack "${id}" has invalid priceId`);
    }
    if (!pack.name || pack.name.length === 0) {
      errors.push(`Credit pack "${id}" has invalid name`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate subscription pricing configuration
 *
 * @returns Validation result with any errors found
 */
export function validateSubscriptionPricing(): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  Object.entries(SUBSCRIPTIONS).forEach(([id, sub]) => {
    if (sub.credits <= 0) {
      errors.push(`Subscription "${id}" has invalid credits: ${sub.credits}`);
    }
    if (sub.amount <= 0) {
      errors.push(`Subscription "${id}" has invalid amount: ${sub.amount}`);
    }
    if (!sub.priceId || sub.priceId.length === 0) {
      errors.push(`Subscription "${id}" has invalid priceId`);
    }
    if (!sub.name || sub.name.length === 0) {
      errors.push(`Subscription "${id}" has invalid name`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate per-credit cost for a credit pack
 *
 * @param pack - The credit pack
 * @returns Cost per credit in cents
 */
export function calculatePerCreditCost(pack: CreditPack): number {
  return pack.amount / pack.credits;
}

/**
 * Format price in cents to dollar string
 *
 * @param cents - Price in cents
 * @returns Formatted price string (e.g., "$9.00")
 */
export function formatPrice(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toFixed(2)}`;
}

/**
 * Get all credit pack IDs
 *
 * @returns Array of credit pack IDs
 */
export function getCreditPackIds(): string[] {
  return Object.keys(CREDIT_PACKS);
}

/**
 * Get all subscription IDs
 *
 * @returns Array of subscription IDs
 */
export function getSubscriptionIds(): string[] {
  return Object.keys(SUBSCRIPTIONS);
}
