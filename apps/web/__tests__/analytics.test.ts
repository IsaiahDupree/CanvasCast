/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock PostHog
const mockCapture = jest.fn();
const mockIdentify = jest.fn();
const mockInit = jest.fn((key, options) => {
  // Call the loaded callback if provided
  if (options?.loaded) {
    options.loaded(mockPostHog);
  }
});
const mockDebug = jest.fn();
const mockReset = jest.fn();

const mockPostHog = {
  init: mockInit,
  capture: mockCapture,
  identify: mockIdentify,
  debug: mockDebug,
  reset: mockReset,
};

jest.mock('posthog-js', () => ({
  __esModule: true,
  default: mockPostHog,
}));

describe('Analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PostHog Initialization', () => {
    it('should initialize PostHog with API key and config', async () => {
      const { initPostHog } = await import('@/lib/analytics');

      initPostHog();

      expect(mockInit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          api_host: expect.any(String),
          loaded: expect.any(Function),
        })
      );
    });

    it('should not initialize if API key is missing', async () => {
      const originalEnv = process.env.NEXT_PUBLIC_POSTHOG_KEY;
      delete process.env.NEXT_PUBLIC_POSTHOG_KEY;

      const { initPostHog } = await import('@/lib/analytics');

      initPostHog();

      expect(mockInit).not.toHaveBeenCalled();

      process.env.NEXT_PUBLIC_POSTHOG_KEY = originalEnv;
    });
  });

  describe('Page View Tracking', () => {
    it('should track page views with correct properties', async () => {
      const { trackPageView } = await import('@/lib/analytics');

      trackPageView('/test-page');

      expect(mockCapture).toHaveBeenCalledWith(
        '$pageview',
        expect.objectContaining({
          path: '/test-page',
        })
      );
    });

    it('should include additional properties when provided', async () => {
      const { trackPageView } = await import('@/lib/analytics');

      trackPageView('/test-page', { referrer: 'google' });

      expect(mockCapture).toHaveBeenCalledWith(
        '$pageview',
        expect.objectContaining({
          path: '/test-page',
          referrer: 'google',
        })
      );
    });
  });

  describe('User Identification', () => {
    it('should identify users with correct user ID', async () => {
      const { identifyUser } = await import('@/lib/analytics');

      identifyUser('user-123');

      expect(mockIdentify).toHaveBeenCalledWith('user-123', expect.any(Object));
    });

    it('should identify users with additional properties', async () => {
      const { identifyUser } = await import('@/lib/analytics');

      identifyUser('user-123', {
        email: 'test@example.com',
        plan: 'pro',
      });

      expect(mockIdentify).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          email: 'test@example.com',
          plan: 'pro',
        })
      );
    });

    it('should not identify if user ID is empty', async () => {
      const { identifyUser } = await import('@/lib/analytics');

      identifyUser('');

      expect(mockIdentify).not.toHaveBeenCalled();
    });
  });

  describe('Event Tracking', () => {
    it('should track custom events', async () => {
      const { trackEvent } = await import('@/lib/analytics');

      trackEvent('video_created', { duration: 30 });

      expect(mockCapture).toHaveBeenCalledWith('video_created', { duration: 30 });
    });

    it('should track events without properties', async () => {
      const { trackEvent } = await import('@/lib/analytics');

      trackEvent('button_clicked');

      expect(mockCapture).toHaveBeenCalledWith('button_clicked', {});
    });
  });
});
