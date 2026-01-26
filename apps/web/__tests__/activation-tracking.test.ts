/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock PostHog
const mockCapture = jest.fn();
const mockIdentify = jest.fn();
const mockInit = jest.fn((key, options) => {
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

describe('TRACK-003: Activation Event Tracking', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('cookie-consent', JSON.stringify({ analytics: true }));

    // Reset the PostHog instance between tests
    const { _resetPostHogInstance } = await import('@/lib/analytics');
    _resetPostHogInstance();
  });

  describe('signup_start event', () => {
    it('should track signup_start when user begins email signup', async () => {
      const { initPostHog, trackActivationEvent, ACTIVATION_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackActivationEvent(ACTIVATION_EVENTS.SIGNUP_START, {
        method: 'email',
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'signup_start',
        expect.objectContaining({
          method: 'email',
        })
      );
    });

    it('should track signup_start when user begins OAuth signup', async () => {
      const { initPostHog, trackActivationEvent, ACTIVATION_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackActivationEvent(ACTIVATION_EVENTS.SIGNUP_START, {
        method: 'google',
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'signup_start',
        expect.objectContaining({
          method: 'google',
        })
      );
    });

    it('should include draft context when present', async () => {
      const { initPostHog, trackActivationEvent, ACTIVATION_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackActivationEvent(ACTIVATION_EVENTS.SIGNUP_START, {
        method: 'email',
        has_draft: true,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'signup_start',
        expect.objectContaining({
          method: 'email',
          has_draft: true,
        })
      );
    });
  });

  describe('login_success event', () => {
    it('should track login_success after successful authentication', async () => {
      const { initPostHog, trackActivationEvent, ACTIVATION_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackActivationEvent(ACTIVATION_EVENTS.LOGIN_SUCCESS, {
        method: 'email',
        user_id: 'user-123',
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'login_success',
        expect.objectContaining({
          method: 'email',
          user_id: 'user-123',
        })
      );
    });

    it('should track login_success with OAuth provider', async () => {
      const { initPostHog, trackActivationEvent, ACTIVATION_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackActivationEvent(ACTIVATION_EVENTS.LOGIN_SUCCESS, {
        method: 'google',
        user_id: 'user-456',
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'login_success',
        expect.objectContaining({
          method: 'google',
          user_id: 'user-456',
        })
      );
    });

    it('should include draft claim status when present', async () => {
      const { initPostHog, trackActivationEvent, ACTIVATION_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackActivationEvent(ACTIVATION_EVENTS.LOGIN_SUCCESS, {
        method: 'email',
        user_id: 'user-789',
        draft_claimed: true,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'login_success',
        expect.objectContaining({
          method: 'email',
          user_id: 'user-789',
          draft_claimed: true,
        })
      );
    });
  });

  describe('activation_complete event', () => {
    it('should track activation_complete when user reaches dashboard', async () => {
      const { initPostHog, trackActivationEvent, ACTIVATION_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackActivationEvent(ACTIVATION_EVENTS.ACTIVATION_COMPLETE, {
        user_id: 'user-123',
        is_new_user: true,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'activation_complete',
        expect.objectContaining({
          user_id: 'user-123',
          is_new_user: true,
        })
      );
    });

    it('should include user credit balance', async () => {
      const { initPostHog, trackActivationEvent, ACTIVATION_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackActivationEvent(ACTIVATION_EVENTS.ACTIVATION_COMPLETE, {
        user_id: 'user-456',
        is_new_user: true,
        credits_balance: 10,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'activation_complete',
        expect.objectContaining({
          user_id: 'user-456',
          is_new_user: true,
          credits_balance: 10,
        })
      );
    });

    it('should distinguish between new and returning users', async () => {
      const { initPostHog, trackActivationEvent, ACTIVATION_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackActivationEvent(ACTIVATION_EVENTS.ACTIVATION_COMPLETE, {
        user_id: 'user-789',
        is_new_user: false,
        credits_balance: 5,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'activation_complete',
        expect.objectContaining({
          user_id: 'user-789',
          is_new_user: false,
          credits_balance: 5,
        })
      );
    });
  });

  describe('Activation event constants', () => {
    it('should export ACTIVATION_EVENTS constants', async () => {
      const { ACTIVATION_EVENTS } = await import('@/lib/analytics');

      expect(ACTIVATION_EVENTS).toBeDefined();
      expect(ACTIVATION_EVENTS.SIGNUP_START).toBe('signup_start');
      expect(ACTIVATION_EVENTS.LOGIN_SUCCESS).toBe('login_success');
      expect(ACTIVATION_EVENTS.ACTIVATION_COMPLETE).toBe('activation_complete');
    });
  });

  describe('trackActivationEvent function', () => {
    it('should not track when PostHog is not initialized', async () => {
      const { trackActivationEvent, ACTIVATION_EVENTS } = await import('@/lib/analytics');

      // Don't call initPostHog
      trackActivationEvent(ACTIVATION_EVENTS.SIGNUP_START, {
        method: 'email',
      });

      expect(mockCapture).not.toHaveBeenCalled();
    });

    it('should track event with empty properties object when none provided', async () => {
      const { initPostHog, trackActivationEvent, ACTIVATION_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackActivationEvent(ACTIVATION_EVENTS.SIGNUP_START);

      expect(mockCapture).toHaveBeenCalledWith('signup_start', {});
    });

    it('should handle tracking errors gracefully', async () => {
      const { initPostHog, trackActivationEvent, ACTIVATION_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      mockCapture.mockImplementationOnce(() => {
        throw new Error('Network error');
      });

      // Should not throw
      expect(() => {
        trackActivationEvent(ACTIVATION_EVENTS.SIGNUP_START, { method: 'email' });
      }).not.toThrow();
    });
  });
});
