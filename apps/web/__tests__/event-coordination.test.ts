/**
 * Event Coordination Utilities Tests (META-005)
 * Tests for helpers that coordinate event IDs between client and server
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  trackAndPrepareServerEvent,
  trackDualWithCAPI,
  extractOrGenerateEventId,
  addEventIdToMetadata,
  generateEventId,
} from '@/lib/event-coordination';

// Mock dependencies
vi.mock('@/lib/meta-pixel-mapper', async () => {
  const actual = await vi.importActual('@/lib/meta-pixel-mapper');
  return {
    ...actual,
    trackEventWithMeta: vi.fn(),
  };
});

import { trackEventWithMeta } from '@/lib/meta-pixel-mapper';

// Mock fetch for CAPI tests
global.fetch = vi.fn();

describe('Event Coordination Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('trackAndPrepareServerEvent', () => {
    it('should generate a unique event ID and track client-side', () => {
      const mockTrackEventWithMeta = vi.mocked(trackEventWithMeta);

      const result = trackAndPrepareServerEvent(
        'purchase_completed',
        { amount: 2999, credits: 100 },
        { email: 'user@example.com' }
      );

      // Should have event ID
      expect(result.eventId).toMatch(/^evt_\d+_[a-z0-9]+$/);

      // Should track client-side with event ID
      expect(mockTrackEventWithMeta).toHaveBeenCalledWith(
        'purchase_completed',
        expect.objectContaining({
          amount: 2999,
          credits: 100,
          meta_event_id: result.eventId,
        })
      );
    });

    it('should create valid server payload with Meta event name', () => {
      const result = trackAndPrepareServerEvent(
        'purchase_completed',
        { amount: 2999, credits: 100 },
        { email: 'user@example.com' }
      );

      expect(result.serverPayload).toMatchObject({
        eventName: 'Purchase', // Mapped from purchase_completed
        eventId: result.eventId,
        eventTime: expect.any(Number),
        userData: {
          email: 'user@example.com',
        },
        customData: {
          value: 29.99, // Converted from cents
          currency: 'USD',
          numItems: 100,
        },
        actionSource: 'website',
      });
    });

    it('should derive custom data from client properties', () => {
      const result = trackAndPrepareServerEvent(
        'checkout_started',
        {
          amount: 4999,
          credits: 200,
          content_type: 'credits',
        },
        { email: 'user@example.com' }
      );

      expect(result.serverPayload.customData).toMatchObject({
        value: 49.99,
        currency: 'USD',
        numItems: 200,
        contentType: 'credits',
      });
    });

    it('should allow custom data override', () => {
      const customData = {
        value: 99.99,
        currency: 'EUR',
        numItems: 500,
      };

      const result = trackAndPrepareServerEvent(
        'purchase_completed',
        { amount: 2999 },
        { email: 'user@example.com' },
        customData
      );

      expect(result.serverPayload.customData).toMatchObject(customData);
    });

    it('should map all CanvasCast events to Meta events', () => {
      const eventMappings = [
        { canvasCast: 'landing_view', meta: 'PageView' },
        { canvasCast: 'signup_completed', meta: 'CompleteRegistration' },
        { canvasCast: 'checkout_started', meta: 'InitiateCheckout' },
        { canvasCast: 'subscription_started', meta: 'Subscribe' },
      ];

      eventMappings.forEach(({ canvasCast, meta }) => {
        const result = trackAndPrepareServerEvent(
          canvasCast,
          {},
          { email: 'user@example.com' }
        );

        expect(result.serverPayload.eventName).toBe(meta);
      });
    });

    it('should include event source URL in browser environment', () => {
      // Mock window.location
      Object.defineProperty(global, 'window', {
        value: {
          location: {
            href: 'https://example.com/checkout',
          },
        },
        writable: true,
      });

      const result = trackAndPrepareServerEvent(
        'purchase_completed',
        { amount: 2999 },
        { email: 'user@example.com' }
      );

      expect(result.serverPayload.eventSourceUrl).toBe('https://example.com/checkout');
    });

    it('should handle video_id in content_ids', () => {
      const result = trackAndPrepareServerEvent(
        'video_generated',
        { video_id: 'video_123' },
        { email: 'user@example.com' }
      );

      expect(result.serverPayload.customData?.contentIds).toEqual(['video_123']);
    });
  });

  describe('trackDualWithCAPI', () => {
    it('should track client-side and send to CAPI endpoint', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: true, eventsReceived: 1 }),
          { status: 200 }
        )
      );

      const result = await trackDualWithCAPI(
        'purchase_completed',
        { amount: 2999, credits: 100 },
        { email: 'user@example.com' }
      );

      expect(result.success).toBe(true);
      expect(result.eventId).toMatch(/^evt_\d+_[a-z0-9]+$/);

      // Verify CAPI endpoint was called
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/meta-capi',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('"eventName":"Purchase"'),
        })
      );
    });

    it('should handle CAPI endpoint errors', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: 'Invalid event data' }),
          { status: 400 }
        )
      );

      const result = await trackDualWithCAPI(
        'purchase_completed',
        { amount: 2999 },
        { email: 'user@example.com' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid event data');
    });

    it('should handle network errors', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await trackDualWithCAPI(
        'purchase_completed',
        { amount: 2999 },
        { email: 'user@example.com' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should send the same event ID to both Pixel and CAPI', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      const mockTrackEventWithMeta = vi.mocked(trackEventWithMeta);

      const result = await trackDualWithCAPI(
        'purchase_completed',
        { amount: 2999 },
        { email: 'user@example.com' }
      );

      // Get the event ID from client tracking
      const clientCall = mockTrackEventWithMeta.mock.calls[0];
      const clientEventId = clientCall[1].meta_event_id;

      // Get the event ID from CAPI request
      const capiCall = mockFetch.mock.calls[0];
      const capiBody = JSON.parse(capiCall[1]?.body as string);
      const serverEventId = capiBody.eventId;

      // They should match!
      expect(clientEventId).toBe(serverEventId);
      expect(clientEventId).toBe(result.eventId);
    });
  });

  describe('extractOrGenerateEventId', () => {
    it('should extract event ID from metadata if present', () => {
      const metadata = {
        user_id: 'user_123',
        meta_event_id: 'evt_1234567890_abc123',
        credits: '100',
      };

      const eventId = extractOrGenerateEventId(metadata);

      expect(eventId).toBe('evt_1234567890_abc123');
    });

    it('should generate new event ID if metadata is missing', () => {
      const eventId = extractOrGenerateEventId();

      expect(eventId).toMatch(/^evt_\d+_[a-z0-9]+$/);
    });

    it('should generate new event ID if meta_event_id is not in metadata', () => {
      const metadata = {
        user_id: 'user_123',
        credits: '100',
      };

      const eventId = extractOrGenerateEventId(metadata);

      expect(eventId).toMatch(/^evt_\d+_[a-z0-9]+$/);
    });

    it('should generate unique IDs when called multiple times without metadata', () => {
      const id1 = extractOrGenerateEventId();
      const id2 = extractOrGenerateEventId();

      expect(id1).not.toBe(id2);
    });
  });

  describe('addEventIdToMetadata', () => {
    it('should add event ID to existing metadata', () => {
      const metadata = {
        user_id: 'user_123',
        credits: '100',
      };

      const eventId = 'evt_1234567890_abc123';
      const result = addEventIdToMetadata(metadata, eventId);

      expect(result).toEqual({
        user_id: 'user_123',
        credits: '100',
        meta_event_id: 'evt_1234567890_abc123',
      });
    });

    it('should not mutate original metadata', () => {
      const metadata = {
        user_id: 'user_123',
      };

      const eventId = 'evt_1234567890_abc123';
      const result = addEventIdToMetadata(metadata, eventId);

      expect(metadata).not.toHaveProperty('meta_event_id');
      expect(result).toHaveProperty('meta_event_id', eventId);
    });

    it('should override existing meta_event_id', () => {
      const metadata = {
        user_id: 'user_123',
        meta_event_id: 'old_event_id',
      };

      const eventId = 'evt_1234567890_abc123';
      const result = addEventIdToMetadata(metadata, eventId);

      expect(result.meta_event_id).toBe('evt_1234567890_abc123');
    });

    it('should work with empty metadata', () => {
      const eventId = 'evt_1234567890_abc123';
      const result = addEventIdToMetadata({}, eventId);

      expect(result).toEqual({
        meta_event_id: 'evt_1234567890_abc123',
      });
    });
  });

  describe('generateEventId', () => {
    it('should generate valid event IDs', () => {
      const id = generateEventId();

      expect(id).toMatch(/^evt_\d+_[a-z0-9]+$/);
      expect(id.length).toBeLessThanOrEqual(40);
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 50; i++) {
        ids.add(generateEventId());
      }

      expect(ids.size).toBe(50);
    });
  });

  describe('Integration: Stripe Checkout Flow', () => {
    it('should coordinate event IDs through Stripe checkout flow', async () => {
      // 1. Client initiates checkout and tracks event
      const { eventId: clientEventId, serverPayload } = trackAndPrepareServerEvent(
        'checkout_started',
        { amount: 2999, credits: 100 },
        { email: 'user@example.com' }
      );

      // 2. Client creates Stripe session with event ID in metadata
      const stripeMetadata = addEventIdToMetadata(
        { user_id: 'user_123', credits: '100' },
        clientEventId
      );

      expect(stripeMetadata).toEqual({
        user_id: 'user_123',
        credits: '100',
        meta_event_id: clientEventId,
      });

      // 3. Webhook receives session and extracts event ID
      const webhookEventId = extractOrGenerateEventId(stripeMetadata);

      // 4. Event IDs should match throughout the flow
      expect(webhookEventId).toBe(clientEventId);
    });
  });
});
