/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

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

describe('TRACK-004: Core Value Event Tracking', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorageMock.clear();
    localStorageMock.setItem('cookie-consent', JSON.stringify({ analytics: true }));

    // Set required env vars
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'test-key';

    // Reset the PostHog instance between tests
    const { _resetPostHogInstance } = await import('@/lib/analytics');
    _resetPostHogInstance();
  });

  describe('project_created event', () => {
    it('should track project_created when user creates a video project', async () => {
      const { initPostHog, trackCoreValueEvent, CORE_VALUE_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackCoreValueEvent(CORE_VALUE_EVENTS.PROJECT_CREATED, {
        project_id: 'proj-123',
        prompt_length: 100,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'project_created',
        expect.objectContaining({
          project_id: 'proj-123',
          prompt_length: 100,
        })
      );
    });

    it('should include niche when tracking project_created', async () => {
      const { initPostHog, trackCoreValueEvent, CORE_VALUE_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackCoreValueEvent(CORE_VALUE_EVENTS.PROJECT_CREATED, {
        project_id: 'proj-456',
        niche: 'tech',
        prompt_length: 120,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'project_created',
        expect.objectContaining({
          project_id: 'proj-456',
          niche: 'tech',
          prompt_length: 120,
        })
      );
    });

    it('should include expected duration when provided', async () => {
      const { initPostHog, trackCoreValueEvent, CORE_VALUE_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackCoreValueEvent(CORE_VALUE_EVENTS.PROJECT_CREATED, {
        project_id: 'proj-789',
        expected_duration: 60,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'project_created',
        expect.objectContaining({
          project_id: 'proj-789',
          expected_duration: 60,
        })
      );
    });
  });

  describe('prompt_submitted event', () => {
    it('should track prompt_submitted when user submits video prompt', async () => {
      const { initPostHog, trackCoreValueEvent, CORE_VALUE_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackCoreValueEvent(CORE_VALUE_EVENTS.PROMPT_SUBMITTED, {
        project_id: 'proj-123',
        job_id: 'job-456',
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'prompt_submitted',
        expect.objectContaining({
          project_id: 'proj-123',
          job_id: 'job-456',
        })
      );
    });

    it('should include credits_reserved when tracking prompt_submitted', async () => {
      const { initPostHog, trackCoreValueEvent, CORE_VALUE_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackCoreValueEvent(CORE_VALUE_EVENTS.PROMPT_SUBMITTED, {
        project_id: 'proj-123',
        job_id: 'job-789',
        credits_reserved: 5,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'prompt_submitted',
        expect.objectContaining({
          project_id: 'proj-123',
          job_id: 'job-789',
          credits_reserved: 5,
        })
      );
    });
  });

  describe('video_generated event', () => {
    it('should track video_generated when video generation completes', async () => {
      const { initPostHog, trackCoreValueEvent, CORE_VALUE_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackCoreValueEvent(CORE_VALUE_EVENTS.VIDEO_GENERATED, {
        project_id: 'proj-123',
        job_id: 'job-456',
        success: true,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'video_generated',
        expect.objectContaining({
          project_id: 'proj-123',
          job_id: 'job-456',
          success: true,
        })
      );
    });

    it('should include video metadata when tracking video_generated', async () => {
      const { initPostHog, trackCoreValueEvent, CORE_VALUE_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackCoreValueEvent(CORE_VALUE_EVENTS.VIDEO_GENERATED, {
        project_id: 'proj-789',
        job_id: 'job-101',
        success: true,
        duration_seconds: 45,
        file_size_mb: 12.5,
        render_time_seconds: 120,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'video_generated',
        expect.objectContaining({
          project_id: 'proj-789',
          job_id: 'job-101',
          success: true,
          duration_seconds: 45,
          file_size_mb: 12.5,
          render_time_seconds: 120,
        })
      );
    });

    it('should track failed video generation', async () => {
      const { initPostHog, trackCoreValueEvent, CORE_VALUE_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackCoreValueEvent(CORE_VALUE_EVENTS.VIDEO_GENERATED, {
        project_id: 'proj-999',
        job_id: 'job-888',
        success: false,
        error_reason: 'API rate limit exceeded',
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'video_generated',
        expect.objectContaining({
          project_id: 'proj-999',
          job_id: 'job-888',
          success: false,
          error_reason: 'API rate limit exceeded',
        })
      );
    });
  });

  describe('video_downloaded event', () => {
    it('should track video_downloaded when user downloads video', async () => {
      const { initPostHog, trackCoreValueEvent, CORE_VALUE_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackCoreValueEvent(CORE_VALUE_EVENTS.VIDEO_DOWNLOADED, {
        project_id: 'proj-123',
        video_url: 'https://storage.canvascast.com/videos/abc123.mp4',
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'video_downloaded',
        expect.objectContaining({
          project_id: 'proj-123',
          video_url: 'https://storage.canvascast.com/videos/abc123.mp4',
        })
      );
    });

    it('should include format when tracking video_downloaded', async () => {
      const { initPostHog, trackCoreValueEvent, CORE_VALUE_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackCoreValueEvent(CORE_VALUE_EVENTS.VIDEO_DOWNLOADED, {
        project_id: 'proj-456',
        video_url: 'https://storage.canvascast.com/videos/def456.mp4',
        format: 'mp4',
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'video_downloaded',
        expect.objectContaining({
          project_id: 'proj-456',
          video_url: 'https://storage.canvascast.com/videos/def456.mp4',
          format: 'mp4',
        })
      );
    });
  });

  describe('script_edited event', () => {
    it('should track script_edited when user edits generated script', async () => {
      const { initPostHog, trackCoreValueEvent, CORE_VALUE_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackCoreValueEvent(CORE_VALUE_EVENTS.SCRIPT_EDITED, {
        project_id: 'proj-123',
        edit_count: 1,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'script_edited',
        expect.objectContaining({
          project_id: 'proj-123',
          edit_count: 1,
        })
      );
    });

    it('should include characters changed when tracking script_edited', async () => {
      const { initPostHog, trackCoreValueEvent, CORE_VALUE_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackCoreValueEvent(CORE_VALUE_EVENTS.SCRIPT_EDITED, {
        project_id: 'proj-789',
        edit_count: 3,
        characters_changed: 45,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'script_edited',
        expect.objectContaining({
          project_id: 'proj-789',
          edit_count: 3,
          characters_changed: 45,
        })
      );
    });
  });

  describe('voice_selected event', () => {
    it('should track voice_selected when user selects voice option', async () => {
      const { initPostHog, trackCoreValueEvent, CORE_VALUE_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackCoreValueEvent(CORE_VALUE_EVENTS.VOICE_SELECTED, {
        project_id: 'proj-123',
        voice_id: 'alloy',
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'voice_selected',
        expect.objectContaining({
          project_id: 'proj-123',
          voice_id: 'alloy',
        })
      );
    });

    it('should include voice characteristics when tracking voice_selected', async () => {
      const { initPostHog, trackCoreValueEvent, CORE_VALUE_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackCoreValueEvent(CORE_VALUE_EVENTS.VOICE_SELECTED, {
        project_id: 'proj-456',
        voice_id: 'nova',
        voice_gender: 'female',
        voice_accent: 'american',
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'voice_selected',
        expect.objectContaining({
          project_id: 'proj-456',
          voice_id: 'nova',
          voice_gender: 'female',
          voice_accent: 'american',
        })
      );
    });
  });

  describe('Core Value event constants', () => {
    it('should export CORE_VALUE_EVENTS constants', async () => {
      const { CORE_VALUE_EVENTS } = await import('@/lib/analytics');

      expect(CORE_VALUE_EVENTS).toBeDefined();
      expect(CORE_VALUE_EVENTS.PROJECT_CREATED).toBe('project_created');
      expect(CORE_VALUE_EVENTS.PROMPT_SUBMITTED).toBe('prompt_submitted');
      expect(CORE_VALUE_EVENTS.VIDEO_GENERATED).toBe('video_generated');
      expect(CORE_VALUE_EVENTS.VIDEO_DOWNLOADED).toBe('video_downloaded');
      expect(CORE_VALUE_EVENTS.SCRIPT_EDITED).toBe('script_edited');
      expect(CORE_VALUE_EVENTS.VOICE_SELECTED).toBe('voice_selected');
    });
  });

  describe('trackCoreValueEvent function', () => {
    it('should not track when PostHog is not initialized', async () => {
      const { trackCoreValueEvent, CORE_VALUE_EVENTS } = await import('@/lib/analytics');

      // Don't call initPostHog
      trackCoreValueEvent(CORE_VALUE_EVENTS.PROJECT_CREATED, {
        project_id: 'proj-123',
      });

      expect(mockCapture).not.toHaveBeenCalled();
    });

    it('should track event with empty properties object when none provided', async () => {
      const { initPostHog, trackCoreValueEvent, CORE_VALUE_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      trackCoreValueEvent(CORE_VALUE_EVENTS.PROJECT_CREATED);

      expect(mockCapture).toHaveBeenCalledWith('project_created', {});
    });

    it('should handle tracking errors gracefully', async () => {
      const { initPostHog, trackCoreValueEvent, CORE_VALUE_EVENTS } = await import(
        '@/lib/analytics'
      );

      initPostHog();
      mockCapture.mockImplementationOnce(() => {
        throw new Error('Network error');
      });

      // Should not throw
      expect(() => {
        trackCoreValueEvent(CORE_VALUE_EVENTS.PROJECT_CREATED, { project_id: 'proj-123' });
      }).not.toThrow();
    });
  });
});
