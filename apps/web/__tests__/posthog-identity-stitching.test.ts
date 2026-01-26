/**
 * GDP-009: PostHog Identity Stitching
 * @jest-environment jsdom
 *
 * Test Requirements:
 * 1. Call posthog.identify(personId) on login/signup
 * 2. Pass user properties (email, name, etc.) to PostHog
 * 3. Stitch anonymous session to identified user
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

describe('GDP-009: PostHog Identity Stitching', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset localStorage before each test
    localStorage.clear();
    // Set default cookie consent to allow analytics
    localStorage.setItem('cookie-consent', JSON.stringify({ analytics: true }));

    // Reset the PostHog instance between tests
    const { _resetPostHogInstance } = await import('@/lib/analytics');
    _resetPostHogInstance();
  });

  describe('identifyUserForPostHog', () => {
    it('should call posthog.identify with user ID and properties', async () => {
      const { initPostHog, identifyUserForPostHog } = await import('@/lib/analytics');

      // Initialize PostHog first
      initPostHog();

      const userId = 'user-123';
      const properties = {
        email: 'test@example.com',
        name: 'Test User',
        plan: 'trial',
      };

      await identifyUserForPostHog(userId, properties);

      expect(mockIdentify).toHaveBeenCalledWith(userId, properties);
    });

    it('should handle missing email gracefully', async () => {
      const { initPostHog, identifyUserForPostHog } = await import('@/lib/analytics');

      initPostHog();

      const userId = 'user-456';
      const properties = {
        name: 'Another User',
      };

      await identifyUserForPostHog(userId, properties);

      expect(mockIdentify).toHaveBeenCalledWith(userId, properties);
    });

    it('should not call identify if user ID is missing', async () => {
      const { initPostHog, identifyUserForPostHog } = await import('@/lib/analytics');

      initPostHog();

      const userId = '';
      const properties = {
        email: 'test@example.com',
      };

      await identifyUserForPostHog(userId, properties);

      expect(mockIdentify).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully without throwing', async () => {
      const { initPostHog, identifyUserForPostHog } = await import('@/lib/analytics');

      initPostHog();

      const userId = 'user-789';
      const properties = {
        email: 'error@example.com',
      };

      // Mock posthog.identify to throw an error
      mockIdentify.mockImplementationOnce(() => {
        throw new Error('PostHog error');
      });

      // Should not throw - errors should be caught
      await expect(
        identifyUserForPostHog(userId, properties)
      ).resolves.not.toThrow();
    });

    it('should stitch anonymous session to identified user', async () => {
      const { initPostHog, identifyUserForPostHog } = await import('@/lib/analytics');

      initPostHog();

      // This tests that identify is called, which automatically stitches
      // the anonymous session (if exists) to the identified user in PostHog
      const userId = 'user-with-anon-session';
      const properties = {
        email: 'anon@example.com',
        name: 'Previously Anonymous User',
      };

      await identifyUserForPostHog(userId, properties);

      // PostHog automatically handles session stitching when identify is called
      expect(mockIdentify).toHaveBeenCalledWith(userId, properties);
    });

    it('should work with minimal properties', async () => {
      const { initPostHog, identifyUserForPostHog } = await import('@/lib/analytics');

      initPostHog();

      const userId = 'user-minimal';
      const properties = {};

      await identifyUserForPostHog(userId, properties);

      expect(mockIdentify).toHaveBeenCalledWith(userId, properties);
    });

    it('should pass through all custom properties', async () => {
      const { initPostHog, identifyUserForPostHog } = await import('@/lib/analytics');

      initPostHog();

      const userId = 'user-custom';
      const properties = {
        email: 'custom@example.com',
        name: 'Custom User',
        plan: 'pro',
        customField1: 'value1',
        customField2: 123,
        customField3: true,
      };

      await identifyUserForPostHog(userId, properties);

      expect(mockIdentify).toHaveBeenCalledWith(userId, properties);
    });

    it('should not call identify if PostHog is not initialized', async () => {
      const { identifyUserForPostHog } = await import('@/lib/analytics');

      // Don't initialize PostHog
      const userId = 'user-no-init';
      const properties = {
        email: 'no-init@example.com',
      };

      await identifyUserForPostHog(userId, properties);

      // Should not call identify if PostHog is not initialized
      expect(mockIdentify).not.toHaveBeenCalled();
    });
  });

  describe('Integration with auth flow', () => {
    it('should identify user after successful login', async () => {
      const { initPostHog, identifyUserForPostHog } = await import('@/lib/analytics');

      initPostHog();

      // Simulate the auth callback flow
      const userId = 'auth-user-123';
      const userEmail = 'auth@example.com';

      // This would be called in the auth callback
      await identifyUserForPostHog(userId, {
        email: userEmail,
        authMethod: 'magic_link',
      });

      expect(mockIdentify).toHaveBeenCalledWith(userId, {
        email: userEmail,
        authMethod: 'magic_link',
      });
    });

    it('should identify user after successful OAuth signup', async () => {
      const { initPostHog, identifyUserForPostHog } = await import('@/lib/analytics');

      initPostHog();

      const userId = 'oauth-user-456';
      const userEmail = 'oauth@example.com';

      await identifyUserForPostHog(userId, {
        email: userEmail,
        name: 'OAuth User',
        authMethod: 'google',
      });

      expect(mockIdentify).toHaveBeenCalledWith(userId, {
        email: userEmail,
        name: 'OAuth User',
        authMethod: 'google',
      });
    });
  });

  describe('Person ID consistency', () => {
    it('should use Supabase user ID as person ID', async () => {
      const { initPostHog, identifyUserForPostHog } = await import('@/lib/analytics');

      initPostHog();

      // Person ID should be the Supabase user.id
      const supabaseUserId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

      await identifyUserForPostHog(supabaseUserId, {
        email: 'consistent@example.com',
      });

      // Verify that the exact Supabase user ID is used
      expect(mockIdentify).toHaveBeenCalledWith(
        supabaseUserId,
        expect.objectContaining({
          email: 'consistent@example.com',
        })
      );
    });
  });
});
