import Stripe from 'stripe';

/**
 * Stripe client singleton instance
 */
let stripeInstance: Stripe | null = null;

/**
 * Get or create the Stripe client instance
 *
 * @returns Stripe client instance
 * @throws Error if STRIPE_SECRET_KEY is not set
 */
export function getStripeClient(): Stripe {
  if (stripeInstance) {
    return stripeInstance;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is required');
  }

  // Initialize Stripe with the supported API version
  stripeInstance = new Stripe(secretKey, {
    apiVersion: '2023-10-16',
    typescript: true,
  });

  return stripeInstance;
}

/**
 * Check if Stripe is running in test mode
 *
 * @returns true if using test key, false if using live key
 */
export function isTestMode(): boolean {
  const secretKey = process.env.STRIPE_SECRET_KEY || '';
  return secretKey.includes('_test_');
}

/**
 * Get the Stripe API mode (test or live)
 *
 * @returns 'test' or 'live'
 */
export function getStripeMode(): 'test' | 'live' {
  return isTestMode() ? 'test' : 'live';
}

/**
 * Reset the Stripe client instance (useful for testing)
 * @internal
 */
export function resetStripeClient(): void {
  stripeInstance = null;
}
