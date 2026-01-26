/**
 * Meta Pixel Integration Tests (META-001)
 * Tests for Facebook Meta Pixel initialization and basic tracking
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initMetaPixel, trackMetaEvent, isMetaPixelLoaded, _resetMetaPixelState } from '@/lib/meta-pixel';

describe('Meta Pixel Integration', () => {
  beforeEach(() => {
    // Clear any existing Meta Pixel state
    _resetMetaPixelState();

    // Mock cookie consent to allow tracking by default
    const mockGetItem = vi.fn().mockReturnValue(
      JSON.stringify({ analytics: true })
    );
    Object.defineProperty(window, 'localStorage', {
      value: { getItem: mockGetItem },
      writable: true,
      configurable: true,
    });
  });

  describe('initMetaPixel', () => {
    it('should initialize Meta Pixel with valid pixel ID', () => {
      const pixelId = '123456789';

      initMetaPixel(pixelId);

      expect((window as any).fbq).toBeDefined();
      expect(typeof (window as any).fbq).toBe('function');
    });

    it('should not initialize if pixel ID is missing', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      initMetaPixel('');

      expect((window as any).fbq).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith('Meta Pixel ID not found. Meta Pixel tracking will not be available.');

      warnSpy.mockRestore();
    });

    it('should not initialize twice', () => {
      const pixelId = '123456789';

      initMetaPixel(pixelId);
      const firstFbq = (window as any).fbq;

      initMetaPixel(pixelId);
      const secondFbq = (window as any).fbq;

      expect(firstFbq).toBe(secondFbq);
    });

    it('should respect cookie consent preferences', () => {
      // Clear state first
      _resetMetaPixelState();

      // Mock localStorage to return no consent
      const mockGetItem = vi.fn().mockReturnValue(
        JSON.stringify({ analytics: false })
      );
      Object.defineProperty(window, 'localStorage', {
        value: { getItem: mockGetItem },
        writable: true,
        configurable: true,
      });

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      initMetaPixel('123456789');

      expect((window as any).fbq).toBeUndefined();
      expect(logSpy).toHaveBeenCalledWith('Meta Pixel disabled due to cookie preferences');

      logSpy.mockRestore();
    });
  });

  describe('isMetaPixelLoaded', () => {
    it('should return false when Meta Pixel is not loaded', () => {
      expect(isMetaPixelLoaded()).toBe(false);
    });

    it('should return true when Meta Pixel is loaded', () => {
      (window as any).fbq = vi.fn();

      expect(isMetaPixelLoaded()).toBe(true);
    });
  });

  describe('trackMetaEvent', () => {
    it('should not track events if Meta Pixel is not initialized', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      trackMetaEvent('PageView', {});

      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('should track PageView event when Meta Pixel is initialized', () => {
      const mockFbq = vi.fn();
      (window as any).fbq = mockFbq;

      trackMetaEvent('PageView', {});

      expect(mockFbq).toHaveBeenCalledWith('track', 'PageView', {});
    });

    it('should track custom events with properties', () => {
      const mockFbq = vi.fn();
      (window as any).fbq = mockFbq;

      const properties = {
        value: 29.99,
        currency: 'USD',
      };

      trackMetaEvent('Purchase', properties);

      expect(mockFbq).toHaveBeenCalledWith('track', 'Purchase', properties);
    });

    it('should track events with eventID for deduplication', () => {
      const mockFbq = vi.fn();
      (window as any).fbq = mockFbq;

      const eventId = 'evt_123456';
      const properties = { value: 29.99, currency: 'USD' };

      trackMetaEvent('Purchase', properties, eventId);

      expect(mockFbq).toHaveBeenCalledWith('track', 'Purchase', properties, { eventID: eventId });
    });
  });
});
