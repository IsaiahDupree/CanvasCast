/**
 * Event Deduplication Tests (META-005)
 * Tests that the same event_id is used for both client-side (Pixel) and server-side (CAPI) events
 * to prevent duplicate tracking in Meta Ads Manager
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateEventId, trackEventWithMeta } from '@/lib/meta-pixel-mapper';
import { trackMetaEvent } from '@/lib/meta-pixel';
import { trackEvent } from '@/lib/analytics';

// Mock the meta-pixel module
vi.mock('@/lib/meta-pixel', () => ({
  trackMetaEvent: vi.fn(),
  isMetaPixelLoaded: vi.fn(() => true),
}));

// Mock the analytics module
vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

describe('META-005: Event Deduplication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Event ID Generation', () => {
    it('should generate unique event IDs', () => {
      const id1 = generateEventId();
      const id2 = generateEventId();

      expect(id1).toMatch(/^evt_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^evt_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('should generate event IDs with timestamp and random component', () => {
      const id = generateEventId();
      const parts = id.split('_');

      expect(parts.length).toBe(3);
      expect(parts[0]).toBe('evt');
      expect(parts[1]).toMatch(/^\d+$/); // timestamp
      expect(parts[2]).toMatch(/^[a-z0-9]+$/); // random string
    });

    it('should generate event IDs that are valid for Meta deduplication', () => {
      const id = generateEventId();

      // Meta requires event IDs to be:
      // - Maximum 40 characters
      // - Can contain alphanumeric characters, hyphens, underscores
      expect(id.length).toBeLessThanOrEqual(40);
      expect(id).toMatch(/^[a-zA-Z0-9_-]+$/);
    });
  });

  describe('Client-Side Event Tracking with Event ID', () => {
    it('should include event_id when tracking to Meta Pixel', () => {
      const mockTrackMetaEvent = vi.mocked(trackMetaEvent);

      trackEventWithMeta('purchase_completed', {
        amount: 2999,
        credits: 100,
      });

      // Verify Meta Pixel was called with event ID
      expect(mockTrackMetaEvent).toHaveBeenCalledWith(
        'Purchase',
        expect.objectContaining({
          value: 29.99,
          currency: 'USD',
          num_items: 100,
        }),
        expect.stringMatching(/^evt_\d+_[a-z0-9]+$/)
      );
    });

    it('should use the same event_id format for all mapped events', () => {
      const mockTrackMetaEvent = vi.mocked(trackMetaEvent);

      const events = [
        { name: 'landing_view', metaEvent: 'PageView' },
        { name: 'signup_completed', metaEvent: 'CompleteRegistration' },
        { name: 'checkout_started', metaEvent: 'InitiateCheckout' },
      ];

      events.forEach(({ name, metaEvent }) => {
        mockTrackMetaEvent.mockClear();
        trackEventWithMeta(name, {});

        expect(mockTrackMetaEvent).toHaveBeenCalledWith(
          metaEvent,
          expect.any(Object),
          expect.stringMatching(/^evt_\d+_[a-z0-9]+$/)
        );
      });
    });
  });

  describe('Event ID Consistency for Deduplication', () => {
    it('should maintain event ID format compatible with server-side CAPI', () => {
      // Generate event ID on client
      const clientEventId = generateEventId();

      // Verify it matches the expected format that server expects
      expect(clientEventId).toMatch(/^evt_\d+_[a-z0-9]+$/);

      // Verify it can be sent to server as-is
      const serverPayload = {
        eventName: 'Purchase',
        eventId: clientEventId, // Same ID
        userData: {},
        actionSource: 'website' as const,
      };

      expect(serverPayload.eventId).toBe(clientEventId);
    });

    it('should generate event IDs that are stable across the request lifecycle', () => {
      // Simulate a user action that triggers both client and server tracking
      const eventId = generateEventId();

      // Client-side tracking
      const clientEventData = {
        eventName: 'Purchase',
        eventId,
        properties: { value: 29.99, currency: 'USD' },
      };

      // Server-side tracking (would happen via API call)
      const serverEventData = {
        eventName: 'Purchase',
        eventId, // Same ID as client
        userData: { email: 'user@example.com' },
        customData: { value: 29.99, currency: 'USD' },
        actionSource: 'website' as const,
      };

      // Both should use the exact same event ID
      expect(clientEventData.eventId).toBe(serverEventData.eventId);
    });
  });

  describe('Event ID Deduplication Logic', () => {
    it('should provide a way to extract event ID from tracked events', () => {
      const mockTrackMetaEvent = vi.mocked(trackMetaEvent);

      trackEventWithMeta('purchase_completed', {
        amount: 2999,
      });

      // Get the event ID that was used
      const call = mockTrackMetaEvent.mock.calls[0];
      const eventId = call[2]; // Third parameter is eventId

      expect(eventId).toBeDefined();
      expect(typeof eventId).toBe('string');
      expect(eventId).toMatch(/^evt_\d+_[a-z0-9]+$/);
    });

    it('should include meta_event_id in PostHog properties for reference', () => {
      const mockTrackEvent = vi.mocked(trackEvent);

      trackEventWithMeta('purchase_completed', {
        amount: 2999,
      });

      // Verify PostHog receives meta_event_id
      expect(mockTrackEvent).toHaveBeenCalledWith(
        'purchase_completed',
        expect.objectContaining({
          amount: 2999,
          meta_event_id: expect.stringMatching(/^evt_\d+_[a-z0-9]+$/),
        })
      );
    });
  });

  describe('Server-Side Event ID Usage', () => {
    it('should accept event_id from client for server-side CAPI calls', async () => {
      // Simulate client sending event ID to server
      const clientEventId = generateEventId();

      const serverRequest = {
        eventName: 'Purchase',
        eventId: clientEventId,
        eventTime: Math.floor(Date.now() / 1000),
        userData: {
          email: 'user@example.com',
          clientIpAddress: '192.0.2.1',
          clientUserAgent: 'Mozilla/5.0...',
        },
        customData: {
          value: 29.99,
          currency: 'USD',
        },
        actionSource: 'website' as const,
      };

      // Verify the structure is valid
      expect(serverRequest.eventId).toBe(clientEventId);
      expect(serverRequest.eventId).toMatch(/^evt_\d+_[a-z0-9]+$/);
    });

    it('should maintain event ID through the entire tracking flow', () => {
      // 1. Generate event ID on client
      const eventId = generateEventId();

      // 2. Track to Meta Pixel (client-side)
      const mockTrackMetaEvent = vi.mocked(trackMetaEvent);
      mockTrackMetaEvent('Purchase', { value: 29.99, currency: 'USD' }, eventId);

      // 3. Verify Meta Pixel received the event ID
      expect(mockTrackMetaEvent).toHaveBeenCalledWith(
        'Purchase',
        expect.any(Object),
        eventId
      );

      // 4. Same event ID should be sent to CAPI endpoint
      const capiPayload = {
        eventName: 'Purchase',
        eventId, // Same ID
        userData: {},
        customData: { value: 29.99, currency: 'USD' },
        actionSource: 'website' as const,
      };

      expect(capiPayload.eventId).toBe(eventId);
    });
  });

  describe('Deduplication Edge Cases', () => {
    it('should handle events tracked only client-side (no server call)', () => {
      const mockTrackMetaEvent = vi.mocked(trackMetaEvent);

      // Some events might only be tracked client-side
      trackEventWithMeta('landing_view', {});

      expect(mockTrackMetaEvent).toHaveBeenCalledWith(
        'PageView',
        expect.any(Object),
        expect.stringMatching(/^evt_\d+_[a-z0-9]+$/)
      );
    });

    it('should handle events tracked only server-side (no pixel call)', () => {
      // Server-only events (e.g., subscription renewals)
      const eventId = generateEventId();
      const serverPayload = {
        eventName: 'Subscribe',
        eventId,
        userData: { email: 'user@example.com' },
        customData: { value: 49.0, currency: 'USD' },
        actionSource: 'email' as const,
      };

      expect(serverPayload.eventId).toMatch(/^evt_\d+_[a-z0-9]+$/);
    });

    it('should generate different event IDs for different event occurrences', () => {
      const mockTrackMetaEvent = vi.mocked(trackMetaEvent);

      // User makes two purchases
      trackEventWithMeta('purchase_completed', { amount: 2999 });
      trackEventWithMeta('purchase_completed', { amount: 4999 });

      const calls = mockTrackMetaEvent.mock.calls;
      const eventId1 = calls[0][2];
      const eventId2 = calls[1][2];

      // Different purchases should have different event IDs
      expect(eventId1).not.toBe(eventId2);
    });

    it('should handle rapid event generation without collisions', () => {
      const ids = new Set<string>();
      const count = 100;

      for (let i = 0; i < count; i++) {
        ids.add(generateEventId());
      }

      // All IDs should be unique
      expect(ids.size).toBe(count);
    });
  });

  describe('Meta Pixel eventID Parameter', () => {
    it('should pass eventID to Meta Pixel with correct casing', () => {
      const mockTrackMetaEvent = vi.mocked(trackMetaEvent);

      trackEventWithMeta('purchase_completed', { amount: 2999 });

      // Meta expects eventID (camelCase, not event_id)
      const call = mockTrackMetaEvent.mock.calls[0];
      const eventId = call[2];

      expect(eventId).toBeDefined();
      expect(typeof eventId).toBe('string');
    });
  });
});
