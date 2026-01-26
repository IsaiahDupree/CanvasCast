/**
 * Meta Pixel Event Mapper (META-003)
 * Maps CanvasCast events to Meta Pixel standard events
 *
 * Based on PRD_META_PIXEL_TRACKING.md:
 * - landing_view → PageView
 * - demo_video_played → ViewContent (content_type: 'demo')
 * - signup_completed → CompleteRegistration
 * - video_generated → ViewContent (content_type: 'video')
 * - video_downloaded → AddToCart (content_type: 'video')
 * - checkout_started → InitiateCheckout
 * - purchase_completed → Purchase
 * - subscription_started → Subscribe
 */

import { trackMetaEvent } from './meta-pixel';
import { trackEvent } from './analytics';

/**
 * Result of mapping a CanvasCast event to a Meta event
 */
export interface MetaEventMapping {
  eventName: string;
  properties: Record<string, any>;
}

/**
 * Generate a unique event ID for deduplication between client and server
 * Format: evt_{timestamp}_{random}
 */
export function generateEventId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `evt_${timestamp}_${random}`;
}

/**
 * Convert amount in cents to dollars
 */
function centsToDollars(cents: number): number {
  return Math.round((cents / 100) * 100) / 100;
}

/**
 * Calculate predicted LTV for subscriptions
 * Uses 6-month retention assumption
 */
function calculatePredictedLTV(monthlyValue: number): number {
  const AVERAGE_RETENTION_MONTHS = 6;
  return Math.round(monthlyValue * AVERAGE_RETENTION_MONTHS * 100) / 100;
}

/**
 * Map a CanvasCast event to a Meta Pixel standard event
 * Returns null if the event should not be tracked to Meta Pixel
 */
export function mapToMetaEvent(
  eventName: string,
  properties: Record<string, any>
): MetaEventMapping | null {
  switch (eventName) {
    case 'landing_view':
      return {
        eventName: 'PageView',
        properties: {},
      };

    case 'demo_video_played':
      return {
        eventName: 'ViewContent',
        properties: {
          content_type: 'demo',
        },
      };

    case 'signup_completed':
      return {
        eventName: 'CompleteRegistration',
        properties: {
          content_name: 'signup',
          status: 'completed',
          ...properties,
        },
      };

    case 'video_generated':
      return {
        eventName: 'ViewContent',
        properties: {
          content_type: 'video',
          content_ids: properties.video_id ? [properties.video_id] : [],
          ...properties,
        },
      };

    case 'video_downloaded':
      return {
        eventName: 'AddToCart',
        properties: {
          content_type: 'video',
          ...properties,
        },
      };

    case 'checkout_started':
      return {
        eventName: 'InitiateCheckout',
        properties: {
          value: properties.amount ? centsToDollars(properties.amount) : 0,
          currency: 'USD',
          ...properties,
        },
      };

    case 'purchase_completed':
      return {
        eventName: 'Purchase',
        properties: {
          value: properties.amount ? centsToDollars(properties.amount) : 0,
          currency: 'USD',
          num_items: properties.credits || 0,
          ...properties,
        },
      };

    case 'subscription_started':
    case 'subscription_completed':
      const monthlyValue = properties.amount ? centsToDollars(properties.amount) : 0;
      return {
        eventName: 'Subscribe',
        properties: {
          value: monthlyValue,
          currency: 'USD',
          predicted_ltv: calculatePredictedLTV(monthlyValue),
          ...properties,
        },
      };

    default:
      // Event not mapped to Meta Pixel
      return null;
  }
}

/**
 * Track an event to both PostHog and Meta Pixel (if mapped)
 * Automatically handles event mapping and deduplication
 *
 * @param eventName - The CanvasCast event name
 * @param properties - Event properties
 */
export function trackEventWithMeta(
  eventName: string,
  properties?: Record<string, any>
): void {
  const props = properties || {};

  // Always track to PostHog
  const metaMapping = mapToMetaEvent(eventName, props);

  if (metaMapping) {
    // Generate event ID for deduplication with CAPI
    const eventId = generateEventId();

    // Track to PostHog with meta_event_id for reference
    trackEvent(eventName, {
      ...props,
      meta_event_id: eventId,
    });

    // Track to Meta Pixel
    trackMetaEvent(metaMapping.eventName, metaMapping.properties, eventId);
  } else {
    // Only track to PostHog (no Meta mapping)
    trackEvent(eventName, props);
  }
}

/**
 * Map of CanvasCast events to Meta Pixel standard events (for reference)
 */
export const EVENT_MAPPING = {
  landing_view: 'PageView',
  demo_video_played: 'ViewContent',
  signup_completed: 'CompleteRegistration',
  video_generated: 'ViewContent',
  video_downloaded: 'AddToCart',
  checkout_started: 'InitiateCheckout',
  purchase_completed: 'Purchase',
  subscription_started: 'Subscribe',
  subscription_completed: 'Subscribe',
} as const;
