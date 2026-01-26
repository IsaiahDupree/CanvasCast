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

describe('TRACK-008: User Identification', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('cookie-consent', JSON.stringify({ analytics: true }));

    // Reset the PostHog instance between tests
    const { _resetPostHogInstance } = await import('@/lib/analytics');
    _resetPostHogInstance();
  });

  describe('identifyUser function', () => {
    it('should identify user with user ID on login', async () => {
      const { initPostHog, identifyUser } = await import('@/lib/analytics');

      initPostHog();
      identifyUser('user-123', {
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(mockIdentify).toHaveBeenCalledWith('user-123', {
        email: 'test@example.com',
        name: 'Test User',
      });
    });

    it('should identify user with plan information', async () => {
      const { initPostHog, identifyUser } = await import('@/lib/analytics');

      initPostHog();
      identifyUser('user-456', {
        email: 'premium@example.com',
        name: 'Premium User',
        plan: 'pro',
        credits: 100,
      });

      expect(mockIdentify).toHaveBeenCalledWith('user-456', {
        email: 'premium@example.com',
        name: 'Premium User',
        plan: 'pro',
        credits: 100,
      });
    });

    it('should identify user with subscription status', async () => {
      const { initPostHog, identifyUser } = await import('@/lib/analytics');

      initPostHog();
      identifyUser('user-789', {
        email: 'subscriber@example.com',
        name: 'Subscriber',
        plan: 'business',
        subscription_status: 'active',
        subscription_id: 'sub_123',
      });

      expect(mockIdentify).toHaveBeenCalledWith('user-789', {
        email: 'subscriber@example.com',
        name: 'Subscriber',
        plan: 'business',
        subscription_status: 'active',
        subscription_id: 'sub_123',
      });
    });

    it('should identify user with empty properties when none provided', async () => {
      const { initPostHog, identifyUser } = await import('@/lib/analytics');

      initPostHog();
      identifyUser('user-999');

      expect(mockIdentify).toHaveBeenCalledWith('user-999', {});
    });

    it('should not identify when PostHog is not initialized', async () => {
      const { identifyUser } = await import('@/lib/analytics');

      // Don't call initPostHog
      identifyUser('user-123', {
        email: 'test@example.com',
      });

      expect(mockIdentify).not.toHaveBeenCalled();
    });

    it('should not identify when userId is empty string', async () => {
      const { initPostHog, identifyUser } = await import('@/lib/analytics');

      initPostHog();
      identifyUser('', {
        email: 'test@example.com',
      });

      expect(mockIdentify).not.toHaveBeenCalled();
    });

    it('should handle identification errors gracefully', async () => {
      const { initPostHog, identifyUser } = await import('@/lib/analytics');

      initPostHog();
      mockIdentify.mockImplementationOnce(() => {
        throw new Error('Network error');
      });

      // Should not throw
      expect(() => {
        identifyUser('user-123', { email: 'test@example.com' });
      }).not.toThrow();
    });
  });

  describe('User identification on activation', () => {
    it('should identify user after signup', async () => {
      const { initPostHog, identifyUser, trackActivationEvent, ACTIVATION_EVENTS } =
        await import('@/lib/analytics');

      initPostHog();

      // Simulate signup flow
      trackActivationEvent(ACTIVATION_EVENTS.SIGNUP_START, {
        method: 'email',
      });

      // User is created, identify them
      identifyUser('user-new-123', {
        email: 'newuser@example.com',
        name: 'New User',
        created_at: new Date().toISOString(),
        is_new_user: true,
      });

      trackActivationEvent(ACTIVATION_EVENTS.LOGIN_SUCCESS, {
        method: 'email',
        user_id: 'user-new-123',
      });

      expect(mockIdentify).toHaveBeenCalledWith(
        'user-new-123',
        expect.objectContaining({
          email: 'newuser@example.com',
          name: 'New User',
          is_new_user: true,
        })
      );

      expect(mockCapture).toHaveBeenCalledWith(
        'login_success',
        expect.objectContaining({
          method: 'email',
          user_id: 'user-new-123',
        })
      );
    });

    it('should identify user after login', async () => {
      const { initPostHog, identifyUser, trackActivationEvent, ACTIVATION_EVENTS } =
        await import('@/lib/analytics');

      initPostHog();

      // User logs in, identify them
      identifyUser('user-existing-456', {
        email: 'existing@example.com',
        name: 'Existing User',
        last_login: new Date().toISOString(),
        is_new_user: false,
      });

      trackActivationEvent(ACTIVATION_EVENTS.LOGIN_SUCCESS, {
        method: 'google',
        user_id: 'user-existing-456',
      });

      expect(mockIdentify).toHaveBeenCalledWith(
        'user-existing-456',
        expect.objectContaining({
          email: 'existing@example.com',
          name: 'Existing User',
          is_new_user: false,
        })
      );
    });

    it('should include user traits with activation_complete event', async () => {
      const { initPostHog, identifyUser, trackActivationEvent, ACTIVATION_EVENTS } =
        await import('@/lib/analytics');

      initPostHog();

      // Identify user with all traits
      identifyUser('user-activated-789', {
        email: 'activated@example.com',
        name: 'Activated User',
        plan: 'free',
        credits: 10,
        trial_credits: 10,
      });

      trackActivationEvent(ACTIVATION_EVENTS.ACTIVATION_COMPLETE, {
        user_id: 'user-activated-789',
        is_new_user: true,
        credits_balance: 10,
      });

      expect(mockIdentify).toHaveBeenCalledWith(
        'user-activated-789',
        expect.objectContaining({
          email: 'activated@example.com',
          plan: 'free',
          credits: 10,
        })
      );

      expect(mockCapture).toHaveBeenCalledWith(
        'activation_complete',
        expect.objectContaining({
          user_id: 'user-activated-789',
          is_new_user: true,
        })
      );
    });
  });

  describe('User trait updates', () => {
    it('should update user traits when plan changes', async () => {
      const { initPostHog, identifyUser } = await import('@/lib/analytics');

      initPostHog();

      // Initial identification
      identifyUser('user-upgrade-123', {
        email: 'upgrade@example.com',
        plan: 'free',
        credits: 10,
      });

      // User upgrades, update their traits
      identifyUser('user-upgrade-123', {
        email: 'upgrade@example.com',
        plan: 'pro',
        credits: 110,
        subscription_status: 'active',
      });

      expect(mockIdentify).toHaveBeenCalledTimes(2);
      expect(mockIdentify).toHaveBeenLastCalledWith('user-upgrade-123', {
        email: 'upgrade@example.com',
        plan: 'pro',
        credits: 110,
        subscription_status: 'active',
      });
    });

    it('should update user traits when credits change', async () => {
      const { initPostHog, identifyUser } = await import('@/lib/analytics');

      initPostHog();

      // User purchases credits
      identifyUser('user-credits-456', {
        email: 'credits@example.com',
        credits: 10,
      });

      // After purchase
      identifyUser('user-credits-456', {
        email: 'credits@example.com',
        credits: 60,
        last_purchase: new Date().toISOString(),
      });

      expect(mockIdentify).toHaveBeenCalledTimes(2);
      expect(mockIdentify).toHaveBeenLastCalledWith(
        'user-credits-456',
        expect.objectContaining({
          credits: 60,
        })
      );
    });
  });

  describe('AnalyticsUser type', () => {
    it('should accept valid user properties', async () => {
      const { initPostHog, identifyUser } = await import('@/lib/analytics');

      initPostHog();

      const user: any = {
        id: 'user-type-test',
        email: 'typetest@example.com',
        name: 'Type Test',
        plan: 'business',
        custom_field: 'custom_value',
      };

      identifyUser(user.id, user);

      expect(mockIdentify).toHaveBeenCalledWith('user-type-test', user);
    });
  });
});
