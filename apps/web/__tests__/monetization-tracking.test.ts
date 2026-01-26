/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock PostHog
const mockCapture = vi.fn();
const mockIdentify = vi.fn();
const mockInit = vi.fn((key, options) => {
  // Call the loaded callback if provided
  if (options?.loaded) {
    options.loaded(mockPostHog);
  }
});
const mockDebug = vi.fn();
const mockReset = vi.fn();

const mockPostHog = {
  init: mockInit,
  capture: mockCapture,
  identify: mockIdentify,
  debug: mockDebug,
  reset: mockReset,
};

vi.mock('posthog-js', () => ({
  default: mockPostHog,
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

if (typeof global !== 'undefined') {
  Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });
}

describe('Monetization Event Tracking (TRACK-005)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset localStorage before each test
    localStorageMock.clear();
    // Set default cookie consent to allow analytics
    localStorageMock.setItem('cookie-consent', JSON.stringify({ analytics: true }));

    // Set required env vars
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'test-key';

    // Reset the PostHog instance between tests
    const { _resetPostHogInstance } = await import('@/lib/analytics');
    _resetPostHogInstance();
  });

  describe('trackMonetizationEvent', () => {
    it('should track monetization events with correct event name', async () => {
      const { initPostHog, trackMonetizationEvent } = await import('@/lib/analytics');

      initPostHog();
      trackMonetizationEvent('checkout_started', {
        product_type: 'credits',
        amount: 1000,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'checkout_started',
        expect.objectContaining({
          product_type: 'credits',
          amount: 1000,
        })
      );
    });

    it('should track checkout_started event with product details', async () => {
      const { initPostHog, trackMonetizationEvent, MONETIZATION_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackMonetizationEvent(MONETIZATION_EVENTS.CHECKOUT_STARTED, {
        product_type: 'credits',
        product_name: 'Starter Pack',
        amount: 1000,
        credits: 10,
        currency: 'USD',
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'checkout_started',
        expect.objectContaining({
          product_type: 'credits',
          product_name: 'Starter Pack',
          amount: 1000,
          credits: 10,
          currency: 'USD',
        })
      );
    });

    it('should track purchase_completed event with transaction details', async () => {
      const { initPostHog, trackMonetizationEvent, MONETIZATION_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackMonetizationEvent(MONETIZATION_EVENTS.PURCHASE_COMPLETED, {
        product_type: 'credits',
        product_name: 'Creator Pack',
        amount: 2500,
        credits: 30,
        currency: 'USD',
        transaction_id: 'txn_abc123',
        payment_method: 'card',
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'purchase_completed',
        expect.objectContaining({
          product_type: 'credits',
          product_name: 'Creator Pack',
          amount: 2500,
          credits: 30,
          currency: 'USD',
          transaction_id: 'txn_abc123',
          payment_method: 'card',
        })
      );
    });

    it('should track subscription_started event', async () => {
      const { initPostHog, trackMonetizationEvent, MONETIZATION_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackMonetizationEvent(MONETIZATION_EVENTS.SUBSCRIPTION_STARTED, {
        plan: 'hobbyist',
        amount: 1900,
        currency: 'USD',
        interval: 'monthly',
        credits_per_month: 20,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'subscription_started',
        expect.objectContaining({
          plan: 'hobbyist',
          amount: 1900,
          currency: 'USD',
          interval: 'monthly',
          credits_per_month: 20,
        })
      );
    });

    it('should track subscription_completed event', async () => {
      const { initPostHog, trackMonetizationEvent, MONETIZATION_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackMonetizationEvent(MONETIZATION_EVENTS.SUBSCRIPTION_COMPLETED, {
        plan: 'creator',
        amount: 3900,
        currency: 'USD',
        interval: 'monthly',
        credits_per_month: 50,
        subscription_id: 'sub_xyz789',
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'subscription_completed',
        expect.objectContaining({
          plan: 'creator',
          amount: 3900,
          currency: 'USD',
          interval: 'monthly',
          credits_per_month: 50,
          subscription_id: 'sub_xyz789',
        })
      );
    });

    it('should track subscription_cancelled event', async () => {
      const { initPostHog, trackMonetizationEvent, MONETIZATION_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackMonetizationEvent(MONETIZATION_EVENTS.SUBSCRIPTION_CANCELLED, {
        plan: 'hobbyist',
        subscription_id: 'sub_xyz789',
        cancellation_reason: 'user_requested',
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'subscription_cancelled',
        expect.objectContaining({
          plan: 'hobbyist',
          subscription_id: 'sub_xyz789',
          cancellation_reason: 'user_requested',
        })
      );
    });

    it('should track subscription_renewed event', async () => {
      const { initPostHog, trackMonetizationEvent, MONETIZATION_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackMonetizationEvent(MONETIZATION_EVENTS.SUBSCRIPTION_RENEWED, {
        plan: 'creator',
        amount: 3900,
        currency: 'USD',
        subscription_id: 'sub_xyz789',
        renewal_count: 3,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'subscription_renewed',
        expect.objectContaining({
          plan: 'creator',
          amount: 3900,
          currency: 'USD',
          subscription_id: 'sub_xyz789',
          renewal_count: 3,
        })
      );
    });

    it('should not track events if PostHog is not initialized', async () => {
      const { trackMonetizationEvent, MONETIZATION_EVENTS } = await import('@/lib/analytics');

      // Don't initialize PostHog
      trackMonetizationEvent(MONETIZATION_EVENTS.CHECKOUT_STARTED, {
        product_type: 'credits',
        amount: 1000,
      });

      expect(mockCapture).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully when tracking fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockCapture.mockImplementationOnce(() => {
        throw new Error('PostHog error');
      });

      const { initPostHog, trackMonetizationEvent, MONETIZATION_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackMonetizationEvent(MONETIZATION_EVENTS.CHECKOUT_STARTED, {
        product_type: 'credits',
        amount: 1000,
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to track monetization event:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('MONETIZATION_EVENTS constants', () => {
    it('should export all monetization event constants', async () => {
      const { MONETIZATION_EVENTS } = await import('@/lib/analytics');

      expect(MONETIZATION_EVENTS).toEqual({
        CHECKOUT_STARTED: 'checkout_started',
        PURCHASE_COMPLETED: 'purchase_completed',
        SUBSCRIPTION_STARTED: 'subscription_started',
        SUBSCRIPTION_COMPLETED: 'subscription_completed',
        SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
        SUBSCRIPTION_RENEWED: 'subscription_renewed',
      });
    });
  });

  describe('Revenue tracking properties', () => {
    it('should include revenue tracking for purchase events', async () => {
      const { initPostHog, trackMonetizationEvent, MONETIZATION_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackMonetizationEvent(MONETIZATION_EVENTS.PURCHASE_COMPLETED, {
        product_type: 'credits',
        amount: 4900,
        currency: 'USD',
        revenue: 49.0, // PostHog expects revenue in dollars
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'purchase_completed',
        expect.objectContaining({
          amount: 4900,
          revenue: 49.0,
          currency: 'USD',
        })
      );
    });

    it('should include LTV tracking for subscription events', async () => {
      const { initPostHog, trackMonetizationEvent, MONETIZATION_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackMonetizationEvent(MONETIZATION_EVENTS.SUBSCRIPTION_COMPLETED, {
        plan: 'business',
        amount: 9900,
        currency: 'USD',
        revenue: 99.0,
        ltv_estimate: 1188.0, // 12 months * $99
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'subscription_completed',
        expect.objectContaining({
          amount: 9900,
          revenue: 99.0,
          ltv_estimate: 1188.0,
        })
      );
    });
  });
});
