import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock posthog-js - this will use the manual mock in __mocks__
jest.mock('posthog-js');

// Import the mocked functions
import { mockCapture, mockInit, mockIdentify } from 'posthog-js';

// Import after mocking
import {
  trackFunnelEvent,
  FUNNEL_EVENTS,
  getFunnelEventProperties,
  initPostHog,
  _resetPostHogInstance,
} from '@/lib/analytics';

describe('Funnel Metrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset the posthog instance before each test
    _resetPostHogInstance();

    // Set up environment
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'test-api-key';
    process.env.NODE_ENV = 'test';

    // Initialize PostHog - this should trigger the loaded callback
    // which will set posthogInstance = posthog (the mocked module)
    initPostHog();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    _resetPostHogInstance();
  });

  describe('FUNNEL_EVENTS constants', () => {
    it('should define all funnel stage events', () => {
      expect(FUNNEL_EVENTS).toHaveProperty('LANDING_VIEWED');
      expect(FUNNEL_EVENTS).toHaveProperty('SIGNUP_COMPLETED');
      expect(FUNNEL_EVENTS).toHaveProperty('FIRST_VIDEO_CREATED');
      expect(FUNNEL_EVENTS).toHaveProperty('PAID_CONVERSION');
    });

    it('should have consistent event naming', () => {
      expect(FUNNEL_EVENTS.LANDING_VIEWED).toBe('funnel_landing_viewed');
      expect(FUNNEL_EVENTS.SIGNUP_COMPLETED).toBe('funnel_signup_completed');
      expect(FUNNEL_EVENTS.FIRST_VIDEO_CREATED).toBe('funnel_first_video_created');
      expect(FUNNEL_EVENTS.PAID_CONVERSION).toBe('funnel_paid_conversion');
    });
  });

  describe('trackFunnelEvent', () => {
    it('should track landing viewed event', () => {
      // Check if PostHog was initialized
      expect(mockInit).toHaveBeenCalledWith('test-api-key', expect.any(Object));

      trackFunnelEvent(FUNNEL_EVENTS.LANDING_VIEWED, {
        referrer: 'https://google.com',
        utm_source: 'google',
      });

      expect(mockCapture).toHaveBeenCalledWith('funnel_landing_viewed', {
        funnel_stage: 'landing',
        referrer: 'https://google.com',
        utm_source: 'google',
        timestamp: expect.any(String),
      });
    });

    it('should track signup completed event', () => {
      trackFunnelEvent(FUNNEL_EVENTS.SIGNUP_COMPLETED, {
        user_id: 'user-123',
        signup_method: 'google',
        has_draft: true,
      });

      expect(mockCapture).toHaveBeenCalledWith('funnel_signup_completed', {
        funnel_stage: 'signup',
        user_id: 'user-123',
        signup_method: 'google',
        has_draft: true,
        timestamp: expect.any(String),
      });
    });

    it('should track first video created event', () => {
      trackFunnelEvent(FUNNEL_EVENTS.FIRST_VIDEO_CREATED, {
        user_id: 'user-123',
        job_id: 'job-456',
        niche_preset: 'explainer',
        target_minutes: 3,
      });

      expect(mockCapture).toHaveBeenCalledWith('funnel_first_video_created', {
        funnel_stage: 'first_video',
        user_id: 'user-123',
        job_id: 'job-456',
        niche_preset: 'explainer',
        target_minutes: 3,
        timestamp: expect.any(String),
      });
    });

    it('should track paid conversion event', () => {
      trackFunnelEvent(FUNNEL_EVENTS.PAID_CONVERSION, {
        user_id: 'user-123',
        transaction_id: 'txn-789',
        amount: 2900,
        currency: 'USD',
        product_type: 'credit_pack',
      });

      expect(mockCapture).toHaveBeenCalledWith('funnel_paid_conversion', {
        funnel_stage: 'paid_conversion',
        user_id: 'user-123',
        transaction_id: 'txn-789',
        amount: 2900,
        currency: 'USD',
        product_type: 'credit_pack',
        timestamp: expect.any(String),
      });
    });

    it('should not throw if posthog is not initialized', () => {
      // This should not throw even if posthog is not initialized
      expect(() => {
        trackFunnelEvent(FUNNEL_EVENTS.LANDING_VIEWED, {});
      }).not.toThrow();
    });
  });

  describe('getFunnelEventProperties', () => {
    it('should return correct properties for landing stage', () => {
      const props = getFunnelEventProperties(FUNNEL_EVENTS.LANDING_VIEWED);
      expect(props).toEqual({
        funnel_stage: 'landing',
      });
    });

    it('should return correct properties for signup stage', () => {
      const props = getFunnelEventProperties(FUNNEL_EVENTS.SIGNUP_COMPLETED);
      expect(props).toEqual({
        funnel_stage: 'signup',
      });
    });

    it('should return correct properties for first_video stage', () => {
      const props = getFunnelEventProperties(FUNNEL_EVENTS.FIRST_VIDEO_CREATED);
      expect(props).toEqual({
        funnel_stage: 'first_video',
      });
    });

    it('should return correct properties for paid_conversion stage', () => {
      const props = getFunnelEventProperties(FUNNEL_EVENTS.PAID_CONVERSION);
      expect(props).toEqual({
        funnel_stage: 'paid_conversion',
      });
    });
  });

  describe('Funnel stage progression tracking', () => {
    it('should track complete funnel from landing to paid conversion', () => {
      // Stage 1: Landing
      trackFunnelEvent(FUNNEL_EVENTS.LANDING_VIEWED, {
        referrer: 'https://google.com',
      });

      // Stage 2: Signup
      trackFunnelEvent(FUNNEL_EVENTS.SIGNUP_COMPLETED, {
        user_id: 'user-123',
        signup_method: 'email',
      });

      // Stage 3: First Video
      trackFunnelEvent(FUNNEL_EVENTS.FIRST_VIDEO_CREATED, {
        user_id: 'user-123',
        job_id: 'job-456',
      });

      // Stage 4: Paid Conversion
      trackFunnelEvent(FUNNEL_EVENTS.PAID_CONVERSION, {
        user_id: 'user-123',
        transaction_id: 'txn-789',
        amount: 2900,
      });

      // Verify all stages were tracked
      expect(mockCapture).toHaveBeenCalledTimes(4);
      expect(mockCapture).toHaveBeenNthCalledWith(1, 'funnel_landing_viewed', expect.any(Object));
      expect(mockCapture).toHaveBeenNthCalledWith(2, 'funnel_signup_completed', expect.any(Object));
      expect(mockCapture).toHaveBeenNthCalledWith(3, 'funnel_first_video_created', expect.any(Object));
      expect(mockCapture).toHaveBeenNthCalledWith(4, 'funnel_paid_conversion', expect.any(Object));
    });
  });

  describe('Funnel analytics integration', () => {
    it('should include timestamp in all funnel events', () => {
      trackFunnelEvent(FUNNEL_EVENTS.LANDING_VIEWED, {});

      const capturedCall = mockCapture.mock.calls[0];
      expect(capturedCall[1]).toHaveProperty('timestamp');
      expect(typeof capturedCall[1].timestamp).toBe('string');
    });

    it('should preserve custom properties while adding funnel metadata', () => {
      const customProps = {
        custom_field: 'value',
        another_field: 123,
      };

      trackFunnelEvent(FUNNEL_EVENTS.SIGNUP_COMPLETED, customProps);

      const capturedCall = mockCapture.mock.calls[0];
      expect(capturedCall[1]).toMatchObject({
        funnel_stage: 'signup',
        custom_field: 'value',
        another_field: 123,
        timestamp: expect.any(String),
      });
    });
  });
});
