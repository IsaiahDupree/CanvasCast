import { initPostHog, _resetPostHogInstance, getPostHogInstance } from '@/lib/analytics';

// Mock posthog-js
jest.mock('posthog-js', () => ({
  init: jest.fn(),
  capture: jest.fn(),
  identify: jest.fn(),
  reset: jest.fn(),
  debug: jest.fn(),
  opt_out_capturing: jest.fn(),
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

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('Analytics Cookie Consent Integration', () => {
  beforeEach(() => {
    localStorageMock.clear();
    _resetPostHogInstance();
    jest.clearAllMocks();

    // Set required env vars
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  });

  it('should not initialize PostHog when no consent is given', () => {
    const posthog = require('posthog-js');

    initPostHog();

    expect(posthog.init).not.toHaveBeenCalled();
  });

  it('should not initialize PostHog when consent is rejected', () => {
    const posthog = require('posthog-js');

    // User rejects analytics
    localStorageMock.setItem('cookie-consent', JSON.stringify({
      analytics: false,
      timestamp: new Date().toISOString(),
    }));

    initPostHog();

    expect(posthog.init).not.toHaveBeenCalled();
  });

  it('should initialize PostHog when consent is accepted', () => {
    const posthog = require('posthog-js');

    // User accepts analytics
    localStorageMock.setItem('cookie-consent', JSON.stringify({
      analytics: true,
      timestamp: new Date().toISOString(),
    }));

    initPostHog();

    expect(posthog.init).toHaveBeenCalledWith(
      'test-key',
      expect.objectContaining({
        api_host: 'https://app.posthog.com',
        capture_pageview: true,
        respect_dnt: true,
      })
    );
  });

  it('should not initialize multiple times', () => {
    const posthog = require('posthog-js');

    // User accepts analytics
    localStorageMock.setItem('cookie-consent', JSON.stringify({
      analytics: true,
      timestamp: new Date().toISOString(),
    }));

    // Mock successful initialization
    posthog.init.mockImplementation((key, config) => {
      if (config.loaded) {
        config.loaded(posthog);
      }
    });

    initPostHog();
    initPostHog();

    expect(posthog.init).toHaveBeenCalledTimes(1);
  });

  it('should handle malformed consent data gracefully', () => {
    const posthog = require('posthog-js');

    // Invalid JSON
    localStorageMock.setItem('cookie-consent', 'invalid-json');

    initPostHog();

    expect(posthog.init).not.toHaveBeenCalled();
  });
});
