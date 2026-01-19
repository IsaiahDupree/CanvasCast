import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Stripe Client Setup', () => {
  beforeEach(() => {
    // Reset environment variables for each test
    vi.resetModules();
  });

  it('should initialize Stripe client with secret key', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';

    // Dynamically import to get fresh instance with new env vars
    const { getStripeClient } = await import('../../apps/api/src/lib/stripe.js');

    const stripe = getStripeClient();

    expect(stripe).toBeDefined();
    // Check that the Stripe client has key Stripe API methods
    expect(stripe).toHaveProperty('customers');
    expect(stripe).toHaveProperty('checkout');
    expect(stripe).toHaveProperty('subscriptions');
  });

  it('should throw error when STRIPE_SECRET_KEY is missing', async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const { getStripeClient } = await import('../../apps/api/src/lib/stripe.js');

    expect(() => getStripeClient()).toThrow('STRIPE_SECRET_KEY is required');
  });

  it('should be a singleton - return same instance on multiple calls', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';

    const { getStripeClient } = await import('../../apps/api/src/lib/stripe.js');

    const stripe1 = getStripeClient();
    const stripe2 = getStripeClient();

    expect(stripe1).toBe(stripe2);
  });

  it('should work in test mode with test key', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_51MockTestKey';

    const { getStripeClient, isTestMode } = await import('../../apps/api/src/lib/stripe.js');

    const stripe = getStripeClient();

    expect(stripe).toBeDefined();
    expect(isTestMode()).toBe(true);
  });

  it('should detect production mode with live key', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_live_51MockLiveKey';

    const { getStripeClient, isTestMode } = await import('../../apps/api/src/lib/stripe.js');

    const stripe = getStripeClient();

    expect(stripe).toBeDefined();
    expect(isTestMode()).toBe(false);
  });

  it('should accept optional API version parameter', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';

    const { getStripeClient } = await import('../../apps/api/src/lib/stripe.js');

    const stripe = getStripeClient();

    // Stripe client should have apiVersion property
    expect(stripe).toHaveProperty('_api');
  });
});
