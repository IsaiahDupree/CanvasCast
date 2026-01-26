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

describe('TRACK-002: Acquisition Event Tracking', () => {
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

  describe('landing_view event', () => {
    it('should track landing_view when landing page is viewed', async () => {
      const { initPostHog, trackAcquisitionEvent, ACQUISITION_EVENTS } = await import('@/lib/analytics');

      initPostHog();
      trackAcquisitionEvent(ACQUISITION_EVENTS.LANDING_VIEW);

      expect(mockCapture).toHaveBeenCalledWith(
        'landing_view',
        expect.objectContaining({})
      );
    });

    it('should include UTM parameters when tracking landing_view', async () => {
      const { initPostHog, trackAcquisitionEvent, ACQUISITION_EVENTS } = await import('@/lib/analytics');

      initPostHog();
      trackAcquisitionEvent(ACQUISITION_EVENTS.LANDING_VIEW, {
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'brand-search',
        utm_term: 'ai video generator',
        utm_content: 'ad-variant-a',
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'landing_view',
        expect.objectContaining({
          utm_source: 'google',
          utm_medium: 'cpc',
          utm_campaign: 'brand-search',
          utm_term: 'ai video generator',
          utm_content: 'ad-variant-a',
        })
      );
    });

    it('should include referrer when tracking landing_view', async () => {
      const { initPostHog, trackAcquisitionEvent, ACQUISITION_EVENTS } = await import('@/lib/analytics');

      initPostHog();
      trackAcquisitionEvent(ACQUISITION_EVENTS.LANDING_VIEW, {
        referrer: 'https://google.com',
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'landing_view',
        expect.objectContaining({
          referrer: 'https://google.com',
        })
      );
    });

    it('should include page URL when tracking landing_view', async () => {
      const { initPostHog, trackAcquisitionEvent, ACQUISITION_EVENTS } = await import('@/lib/analytics');

      initPostHog();
      trackAcquisitionEvent(ACQUISITION_EVENTS.LANDING_VIEW, {
        url: 'https://canvascast.com/?utm_source=google',
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'landing_view',
        expect.objectContaining({
          url: 'https://canvascast.com/?utm_source=google',
        })
      );
    });
  });

  describe('cta_click event', () => {
    it('should track cta_click when CTA button is clicked', async () => {
      const { initPostHog, trackAcquisitionEvent, ACQUISITION_EVENTS } = await import('@/lib/analytics');

      initPostHog();
      trackAcquisitionEvent(ACQUISITION_EVENTS.CTA_CLICK);

      expect(mockCapture).toHaveBeenCalledWith(
        'cta_click',
        expect.objectContaining({})
      );
    });

    it('should include CTA location when tracking cta_click', async () => {
      const { initPostHog, trackAcquisitionEvent, ACQUISITION_EVENTS } = await import('@/lib/analytics');

      initPostHog();
      trackAcquisitionEvent(ACQUISITION_EVENTS.CTA_CLICK, {
        location: 'hero',
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'cta_click',
        expect.objectContaining({
          location: 'hero',
        })
      );
    });

    it('should include CTA text when tracking cta_click', async () => {
      const { initPostHog, trackAcquisitionEvent, ACQUISITION_EVENTS } = await import('@/lib/analytics');

      initPostHog();
      trackAcquisitionEvent(ACQUISITION_EVENTS.CTA_CLICK, {
        cta_text: 'Get Started Free',
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'cta_click',
        expect.objectContaining({
          cta_text: 'Get Started Free',
        })
      );
    });

    it('should preserve UTM parameters when tracking cta_click', async () => {
      const { initPostHog, trackAcquisitionEvent, ACQUISITION_EVENTS } = await import('@/lib/analytics');

      initPostHog();
      trackAcquisitionEvent(ACQUISITION_EVENTS.CTA_CLICK, {
        location: 'footer',
        utm_source: 'twitter',
        utm_campaign: 'product-launch',
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'cta_click',
        expect.objectContaining({
          location: 'footer',
          utm_source: 'twitter',
          utm_campaign: 'product-launch',
        })
      );
    });
  });

  describe('pricing_view event', () => {
    it('should track pricing_view when pricing page is viewed', async () => {
      const { initPostHog, trackAcquisitionEvent, ACQUISITION_EVENTS } = await import('@/lib/analytics');

      initPostHog();
      trackAcquisitionEvent(ACQUISITION_EVENTS.PRICING_VIEW);

      expect(mockCapture).toHaveBeenCalledWith(
        'pricing_view',
        expect.objectContaining({})
      );
    });

    it('should include UTM parameters when tracking pricing_view', async () => {
      const { initPostHog, trackAcquisitionEvent, ACQUISITION_EVENTS } = await import('@/lib/analytics');

      initPostHog();
      trackAcquisitionEvent(ACQUISITION_EVENTS.PRICING_VIEW, {
        utm_source: 'email',
        utm_campaign: 'pricing-announcement',
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'pricing_view',
        expect.objectContaining({
          utm_source: 'email',
          utm_campaign: 'pricing-announcement',
        })
      );
    });

    it('should include referrer when tracking pricing_view', async () => {
      const { initPostHog, trackAcquisitionEvent, ACQUISITION_EVENTS } = await import('@/lib/analytics');

      initPostHog();
      trackAcquisitionEvent(ACQUISITION_EVENTS.PRICING_VIEW, {
        referrer: 'https://canvascast.com',
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'pricing_view',
        expect.objectContaining({
          referrer: 'https://canvascast.com',
        })
      );
    });
  });

  describe('UTM parameter extraction', () => {
    it('should extract all UTM parameters from URL', async () => {
      const { extractUtmParams } = await import('@/lib/analytics');

      // Mock URLSearchParams
      const mockUrl = new URL('https://canvascast.com/?utm_source=google&utm_medium=cpc&utm_campaign=brand&utm_term=keyword&utm_content=ad1');
      const params = extractUtmParams(mockUrl.searchParams);

      expect(params).toEqual({
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'brand',
        utm_term: 'keyword',
        utm_content: 'ad1',
      });
    });

    it('should return empty object when no UTM parameters present', async () => {
      const { extractUtmParams } = await import('@/lib/analytics');

      const mockUrl = new URL('https://canvascast.com/');
      const params = extractUtmParams(mockUrl.searchParams);

      expect(params).toEqual({});
    });

    it('should handle partial UTM parameters', async () => {
      const { extractUtmParams } = await import('@/lib/analytics');

      const mockUrl = new URL('https://canvascast.com/?utm_source=twitter&utm_campaign=launch');
      const params = extractUtmParams(mockUrl.searchParams);

      expect(params).toEqual({
        utm_source: 'twitter',
        utm_campaign: 'launch',
      });
    });
  });
});
