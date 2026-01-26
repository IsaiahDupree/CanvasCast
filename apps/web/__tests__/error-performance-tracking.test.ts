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

// Mock web-vitals
const mockOnCLS = jest.fn();
const mockOnFID = jest.fn();
const mockOnFCP = jest.fn();
const mockOnLCP = jest.fn();
const mockOnTTFB = jest.fn();
const mockOnINP = jest.fn();

jest.mock('web-vitals', () => ({
  onCLS: mockOnCLS,
  onFID: mockOnFID,
  onFCP: mockOnFCP,
  onLCP: mockOnLCP,
  onTTFB: mockOnTTFB,
  onINP: mockOnINP,
}));

describe('Error & Performance Tracking (TRACK-007)', () => {
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

  describe('Error Tracking', () => {
    it('should track errors with error message and stack trace', async () => {
      const { initPostHog, trackError } = await import('@/lib/analytics');

      initPostHog();

      const error = new Error('Test error message');
      trackError(error, { context: 'test-component' });

      expect(mockCapture).toHaveBeenCalledWith(
        'error_occurred',
        expect.objectContaining({
          error_message: 'Test error message',
          error_stack: expect.any(String),
          context: 'test-component',
        })
      );
    });

    it('should track errors with error type', async () => {
      const { initPostHog, trackError } = await import('@/lib/analytics');

      initPostHog();

      const error = new TypeError('Type error occurred');
      trackError(error);

      expect(mockCapture).toHaveBeenCalledWith(
        'error_occurred',
        expect.objectContaining({
          error_type: 'TypeError',
          error_message: 'Type error occurred',
        })
      );
    });

    it('should handle string errors', async () => {
      const { initPostHog, trackError } = await import('@/lib/analytics');

      initPostHog();

      trackError('Simple error string');

      expect(mockCapture).toHaveBeenCalledWith(
        'error_occurred',
        expect.objectContaining({
          error_message: 'Simple error string',
          error_type: 'String',
        })
      );
    });

    it('should not track errors if PostHog is not initialized', async () => {
      const { trackError } = await import('@/lib/analytics');

      const error = new Error('Test error');
      trackError(error);

      expect(mockCapture).not.toHaveBeenCalled();
    });
  });

  describe('API Failure Tracking', () => {
    it('should track API failures with status code and endpoint', async () => {
      const { initPostHog, trackApiFailure } = await import('@/lib/analytics');

      initPostHog();

      trackApiFailure({
        endpoint: '/api/v1/projects',
        method: 'POST',
        statusCode: 500,
        errorMessage: 'Internal Server Error',
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'api_failure',
        expect.objectContaining({
          endpoint: '/api/v1/projects',
          method: 'POST',
          status_code: 500,
          error_message: 'Internal Server Error',
        })
      );
    });

    it('should track API failures with response time', async () => {
      const { initPostHog, trackApiFailure } = await import('@/lib/analytics');

      initPostHog();

      trackApiFailure({
        endpoint: '/api/v1/jobs/123',
        method: 'GET',
        statusCode: 404,
        responseTime: 1250,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'api_failure',
        expect.objectContaining({
          endpoint: '/api/v1/jobs/123',
          method: 'GET',
          status_code: 404,
          response_time: 1250,
        })
      );
    });

    it('should categorize error types based on status code', async () => {
      const { initPostHog, trackApiFailure } = await import('@/lib/analytics');

      initPostHog();

      // 4xx error
      trackApiFailure({
        endpoint: '/api/test',
        method: 'GET',
        statusCode: 404,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'api_failure',
        expect.objectContaining({
          error_type: 'client_error',
        })
      );

      mockCapture.mockClear();

      // 5xx error
      trackApiFailure({
        endpoint: '/api/test',
        method: 'POST',
        statusCode: 500,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'api_failure',
        expect.objectContaining({
          error_type: 'server_error',
        })
      );
    });

    it('should not track API failures if PostHog is not initialized', async () => {
      const { trackApiFailure } = await import('@/lib/analytics');

      trackApiFailure({
        endpoint: '/api/test',
        method: 'GET',
        statusCode: 500,
      });

      expect(mockCapture).not.toHaveBeenCalled();
    });
  });

  describe('Core Web Vitals Tracking', () => {
    it('should initialize Core Web Vitals tracking', async () => {
      const { initPostHog, initWebVitals } = await import('@/lib/analytics');

      initPostHog();
      initWebVitals();

      expect(mockOnCLS).toHaveBeenCalledWith(expect.any(Function));
      expect(mockOnFID).toHaveBeenCalledWith(expect.any(Function));
      expect(mockOnFCP).toHaveBeenCalledWith(expect.any(Function));
      expect(mockOnLCP).toHaveBeenCalledWith(expect.any(Function));
      expect(mockOnTTFB).toHaveBeenCalledWith(expect.any(Function));
      expect(mockOnINP).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should track CLS (Cumulative Layout Shift) metric', async () => {
      const { initPostHog, initWebVitals } = await import('@/lib/analytics');

      initPostHog();
      initWebVitals();

      // Get the callback passed to onCLS and call it with a mock metric
      const clsCallback = mockOnCLS.mock.calls[0][0];
      clsCallback({
        name: 'CLS',
        value: 0.05,
        rating: 'good',
        delta: 0.05,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'web_vital',
        expect.objectContaining({
          metric_name: 'CLS',
          metric_value: 0.05,
          metric_rating: 'good',
        })
      );
    });

    it('should track LCP (Largest Contentful Paint) metric', async () => {
      const { initPostHog, initWebVitals } = await import('@/lib/analytics');

      initPostHog();
      initWebVitals();

      const lcpCallback = mockOnLCP.mock.calls[0][0];
      lcpCallback({
        name: 'LCP',
        value: 1500,
        rating: 'good',
        delta: 1500,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'web_vital',
        expect.objectContaining({
          metric_name: 'LCP',
          metric_value: 1500,
          metric_rating: 'good',
        })
      );
    });

    it('should track FID (First Input Delay) metric', async () => {
      const { initPostHog, initWebVitals } = await import('@/lib/analytics');

      initPostHog();
      initWebVitals();

      const fidCallback = mockOnFID.mock.calls[0][0];
      fidCallback({
        name: 'FID',
        value: 50,
        rating: 'good',
        delta: 50,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        'web_vital',
        expect.objectContaining({
          metric_name: 'FID',
          metric_value: 50,
          metric_rating: 'good',
        })
      );
    });

    it('should not initialize web vitals if PostHog is not initialized', async () => {
      const { initWebVitals } = await import('@/lib/analytics');

      initWebVitals();

      expect(mockOnCLS).not.toHaveBeenCalled();
      expect(mockOnLCP).not.toHaveBeenCalled();
    });
  });

  describe('Error & Performance Event Constants', () => {
    it('should export error and performance event constants', async () => {
      const { ERROR_PERFORMANCE_EVENTS } = await import('@/lib/analytics');

      expect(ERROR_PERFORMANCE_EVENTS).toBeDefined();
      expect(ERROR_PERFORMANCE_EVENTS.ERROR_OCCURRED).toBe('error_occurred');
      expect(ERROR_PERFORMANCE_EVENTS.API_FAILURE).toBe('api_failure');
      expect(ERROR_PERFORMANCE_EVENTS.WEB_VITAL).toBe('web_vital');
    });
  });
});
