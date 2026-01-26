/**
 * Tests for META-003: Standard Events Mapping
 * Tests the mapping of CanvasCast events to Meta Pixel standard events
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  mapToMetaEvent,
  trackEventWithMeta,
  generateEventId,
} from '@/lib/meta-pixel-mapper';
import { trackMetaEvent } from '@/lib/meta-pixel';
import * as analytics from '@/lib/analytics';

// Mock the meta-pixel module
vi.mock('@/lib/meta-pixel', () => ({
  trackMetaEvent: vi.fn(),
  isMetaPixelLoaded: vi.fn(() => true),
}));

// Mock the analytics module
vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
  trackAcquisitionEvent: vi.fn(),
  trackActivationEvent: vi.fn(),
  trackCoreValueEvent: vi.fn(),
  trackMonetizationEvent: vi.fn(),
}));

describe('META-003: Standard Events Mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('mapToMetaEvent', () => {
    it('should map landing_view to PageView', () => {
      const result = mapToMetaEvent('landing_view', {});
      expect(result).toEqual({
        eventName: 'PageView',
        properties: {},
      });
    });

    it('should map demo_video_played to ViewContent with content_type', () => {
      const result = mapToMetaEvent('demo_video_played', {});
      expect(result).toEqual({
        eventName: 'ViewContent',
        properties: {
          content_type: 'demo',
        },
      });
    });

    it('should map signup_completed to CompleteRegistration', () => {
      const result = mapToMetaEvent('signup_completed', { method: 'email' });
      expect(result).toEqual({
        eventName: 'CompleteRegistration',
        properties: {
          content_name: 'signup',
          status: 'completed',
          method: 'email',
        },
      });
    });

    it('should map video_generated to ViewContent with content_type video', () => {
      const result = mapToMetaEvent('video_generated', {
        project_id: '123',
        video_id: '456',
      });
      expect(result).toEqual({
        eventName: 'ViewContent',
        properties: {
          content_type: 'video',
          content_ids: ['456'],
          project_id: '123',
          video_id: '456',
        },
      });
    });

    it('should map video_downloaded to AddToCart', () => {
      const result = mapToMetaEvent('video_downloaded', { video_id: '789' });
      expect(result).toEqual({
        eventName: 'AddToCart',
        properties: {
          content_type: 'video',
          video_id: '789',
        },
      });
    });

    it('should map checkout_started to InitiateCheckout', () => {
      const result = mapToMetaEvent('checkout_started', {
        product_type: 'credits',
        amount: 2999,
      });
      expect(result).toEqual({
        eventName: 'InitiateCheckout',
        properties: {
          value: 29.99,
          currency: 'USD',
          product_type: 'credits',
          amount: 2999,
        },
      });
    });

    it('should map purchase_completed to Purchase', () => {
      const result = mapToMetaEvent('purchase_completed', {
        product_type: 'credits',
        amount: 2999,
        credits: 100,
        transaction_id: 'txn_123',
      });
      expect(result).toEqual({
        eventName: 'Purchase',
        properties: {
          value: 29.99,
          currency: 'USD',
          num_items: 100,
          product_type: 'credits',
          amount: 2999,
          credits: 100,
          transaction_id: 'txn_123',
        },
      });
    });

    it('should map subscription_started to Subscribe', () => {
      const result = mapToMetaEvent('subscription_started', {
        plan: 'creator',
        amount: 4900,
        credits_per_month: 200,
      });
      expect(result).toEqual({
        eventName: 'Subscribe',
        properties: {
          value: 49.0,
          currency: 'USD',
          predicted_ltv: 294.0, // 49 * 6 months
          plan: 'creator',
          amount: 4900,
          credits_per_month: 200,
        },
      });
    });

    it('should return null for unmapped events', () => {
      const result = mapToMetaEvent('some_unknown_event', {});
      expect(result).toBeNull();
    });

    it('should handle missing amount gracefully', () => {
      const result = mapToMetaEvent('checkout_started', {
        product_type: 'credits',
      });
      expect(result).toEqual({
        eventName: 'InitiateCheckout',
        properties: {
          value: 0,
          currency: 'USD',
          product_type: 'credits',
        },
      });
    });
  });

  describe('generateEventId', () => {
    it('should generate a unique event ID', () => {
      const id1 = generateEventId();
      const id2 = generateEventId();
      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });

    it('should generate event ID with timestamp prefix', () => {
      const id = generateEventId();
      expect(id).toMatch(/^evt_\d+_[a-z0-9]+$/);
    });
  });

  describe('trackEventWithMeta', () => {
    it('should track both PostHog and Meta Pixel for mapped events', () => {
      trackEventWithMeta('landing_view', {});

      // Should track to PostHog with event ID
      expect(analytics.trackEvent).toHaveBeenCalledWith('landing_view', {
        meta_event_id: expect.stringMatching(/^evt_\d+_[a-z0-9]+$/),
      });

      // Should track to Meta Pixel
      expect(trackMetaEvent).toHaveBeenCalledWith(
        'PageView',
        {},
        expect.stringMatching(/^evt_\d+_[a-z0-9]+$/)
      );
    });

    it('should only track PostHog for unmapped events', () => {
      trackEventWithMeta('some_custom_event', { foo: 'bar' });

      // Should track to PostHog
      expect(analytics.trackEvent).toHaveBeenCalledWith('some_custom_event', {
        foo: 'bar',
      });

      // Should NOT track to Meta Pixel
      expect(trackMetaEvent).not.toHaveBeenCalled();
    });

    it('should preserve original properties when tracking', () => {
      const properties = {
        user_id: '123',
        source: 'google',
      };

      trackEventWithMeta('landing_view', properties);

      expect(analytics.trackEvent).toHaveBeenCalledWith('landing_view', {
        ...properties,
        meta_event_id: expect.stringMatching(/^evt_\d+_[a-z0-9]+$/),
      });
    });

    it('should include event_id in PostHog properties for mapped events', () => {
      trackEventWithMeta('purchase_completed', {
        amount: 2999,
      });

      expect(analytics.trackEvent).toHaveBeenCalledWith('purchase_completed', {
        amount: 2999,
        meta_event_id: expect.stringMatching(/^evt_\d+_[a-z0-9]+$/),
      });
    });

    it('should handle checkout_started event correctly', () => {
      trackEventWithMeta('checkout_started', {
        product_type: 'credits',
        amount: 4900,
      });

      expect(trackMetaEvent).toHaveBeenCalledWith(
        'InitiateCheckout',
        {
          value: 49.0,
          currency: 'USD',
          product_type: 'credits',
          amount: 4900,
        },
        expect.any(String)
      );
    });

    it('should handle subscription_completed event correctly', () => {
      trackEventWithMeta('subscription_completed', {
        plan: 'business',
        amount: 9900,
        subscription_id: 'sub_123',
      });

      expect(trackMetaEvent).toHaveBeenCalledWith(
        'Subscribe',
        expect.objectContaining({
          value: 99.0,
          currency: 'USD',
          plan: 'business',
        }),
        expect.any(String)
      );
    });
  });

  describe('Event mapping consistency', () => {
    it('should map all documented CanvasCast events', () => {
      const documentedEvents = [
        'landing_view',
        'demo_video_played',
        'signup_completed',
        'video_generated',
        'video_downloaded',
        'checkout_started',
        'purchase_completed',
        'subscription_started',
      ];

      documentedEvents.forEach((eventName) => {
        const result = mapToMetaEvent(eventName, {});
        expect(result).not.toBeNull();
        expect(result?.eventName).toBeTruthy();
      });
    });
  });
});
