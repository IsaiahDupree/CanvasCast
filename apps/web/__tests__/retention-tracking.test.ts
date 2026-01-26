import { vi } from 'vitest';

// Mock PostHog
const mockCapture = vi.fn();
const mockIdentify = vi.fn();
const mockInit = vi.fn((key, options) => {
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

// Simple localStorage mock
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

// @ts-ignore
global.localStorage = localStorageMock;

// Mock window object for browser checks
// @ts-ignore
global.window = {};

// Set environment variables for tests
process.env.NEXT_PUBLIC_POSTHOG_KEY = 'test-posthog-key';
process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://test.posthog.com';

describe('TRACK-006: Retention Event Tracking', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorageMock.clear();
    localStorageMock.setItem('cookie-consent', JSON.stringify({ analytics: true }));

    // Reset the PostHog instance between tests
    const { _resetPostHogInstance } = await import('@/lib/analytics');
    _resetPostHogInstance();
  });

  describe('return_session event', () => {
    it('should track return_session when user visits after 24+ hours', async () => {
      const { initPostHog, trackRetentionEvent, RETENTION_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackRetentionEvent(RETENTION_EVENTS.RETURN_SESSION, {
        user_id: 'user-123',
        days_since_last_visit: 3,
        total_sessions: 5,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'return_session',
        expect.objectContaining({
          user_id: 'user-123',
          days_since_last_visit: 3,
          total_sessions: 5,
        })
      );
    });

    it('should track return_session with session details', async () => {
      const { initPostHog, trackRetentionEvent, RETENTION_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackRetentionEvent(RETENTION_EVENTS.RETURN_SESSION, {
        user_id: 'user-456',
        days_since_last_visit: 1,
        total_sessions: 10,
        last_action: 'video_created',
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'return_session',
        expect.objectContaining({
          user_id: 'user-456',
          days_since_last_visit: 1,
          total_sessions: 10,
          last_action: 'video_created',
        })
      );
    });
  });

  describe('returning_user event', () => {
    it('should track returning_user when user performs core action again', async () => {
      const { initPostHog, trackRetentionEvent, RETENTION_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackRetentionEvent(RETENTION_EVENTS.RETURNING_USER, {
        user_id: 'user-789',
        action: 'project_created',
        days_since_signup: 7,
        total_projects: 3,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'returning_user',
        expect.objectContaining({
          user_id: 'user-789',
          action: 'project_created',
          days_since_signup: 7,
          total_projects: 3,
        })
      );
    });

    it('should track returning_user with engagement metrics', async () => {
      const { initPostHog, trackRetentionEvent, RETENTION_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackRetentionEvent(RETENTION_EVENTS.RETURNING_USER, {
        user_id: 'user-101',
        action: 'video_generated',
        days_since_signup: 14,
        total_projects: 5,
        credits_remaining: 8,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'returning_user',
        expect.objectContaining({
          user_id: 'user-101',
          action: 'video_generated',
          days_since_signup: 14,
          total_projects: 5,
          credits_remaining: 8,
        })
      );
    });
  });

  describe('Retention event constants', () => {
    it('should export RETENTION_EVENTS constants', async () => {
      const { RETENTION_EVENTS } = await import('@/lib/analytics');

      expect(RETENTION_EVENTS).toBeDefined();
      expect(RETENTION_EVENTS.RETURN_SESSION).toBe('return_session');
      expect(RETENTION_EVENTS.RETURNING_USER).toBe('returning_user');
    });
  });

  describe('trackRetentionEvent function', () => {
    it('should not track when PostHog is not initialized', async () => {
      const { trackRetentionEvent, RETENTION_EVENTS } = await import('@/lib/analytics');

      // Don't call initPostHog
      trackRetentionEvent(RETENTION_EVENTS.RETURN_SESSION, {
        user_id: 'user-123',
        days_since_last_visit: 3,
      });

      expect(mockCapture).not.toHaveBeenCalled();
    });

    it('should track event with empty properties object when none provided', async () => {
      const { initPostHog, trackRetentionEvent, RETENTION_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackRetentionEvent(RETENTION_EVENTS.RETURN_SESSION);

      expect(mockCapture).toHaveBeenCalledWith('return_session', {});
    });

    it('should handle tracking errors gracefully', async () => {
      const { initPostHog, trackRetentionEvent, RETENTION_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      mockCapture.mockImplementationOnce(() => {
        throw new Error('Network error');
      });

      // Should not throw
      expect(() => {
        trackRetentionEvent(RETENTION_EVENTS.RETURN_SESSION, {
          user_id: 'user-123',
          days_since_last_visit: 3,
        });
      }).not.toThrow();
    });
  });

  describe('Session management', () => {
    it('should include session metadata', async () => {
      const { initPostHog, trackRetentionEvent, RETENTION_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      const sessionStart = new Date().toISOString();

      trackRetentionEvent(RETENTION_EVENTS.RETURN_SESSION, {
        user_id: 'user-202',
        days_since_last_visit: 2,
        total_sessions: 8,
        session_start: sessionStart,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'return_session',
        expect.objectContaining({
          user_id: 'user-202',
          days_since_last_visit: 2,
          total_sessions: 8,
          session_start: sessionStart,
        })
      );
    });
  });
});
