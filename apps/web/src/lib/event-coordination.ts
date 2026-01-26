/**
 * Event Coordination Utilities (META-005)
 * Helpers for coordinating event IDs between client-side (Pixel) and server-side (CAPI) tracking
 *
 * Usage:
 * ```typescript
 * // Client-side: Track and prepare for server-side
 * const { eventId, serverPayload } = await trackAndPrepareServerEvent('purchase_completed', {
 *   amount: 2999,
 *   credits: 100
 * }, {
 *   email: user.email
 * });
 *
 * // Send to your API with the event ID
 * await fetch('/api/purchase', {
 *   body: JSON.stringify({ ...serverPayload })
 * });
 * ```
 */

import { generateEventId, trackEventWithMeta } from './meta-pixel-mapper';

/**
 * User data for server-side tracking
 */
export interface ServerUserData {
  email?: string;
  phone?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
  fbp?: string;
  fbc?: string;
}

/**
 * Custom data for server-side tracking
 */
export interface ServerCustomData {
  value?: number;
  currency?: string;
  contentIds?: string[];
  contentType?: string;
  contentName?: string;
  numItems?: number;
  status?: string;
  predictedLtv?: number;
}

/**
 * Server event payload for Meta CAPI
 */
export interface ServerEventPayload {
  eventName: string;
  eventId: string;
  eventTime: number;
  eventSourceUrl?: string;
  userData: ServerUserData;
  customData?: ServerCustomData;
  actionSource: 'website' | 'email' | 'app';
}

/**
 * Result of tracking and preparing a server event
 */
export interface TrackAndPrepareResult {
  eventId: string;
  serverPayload: ServerEventPayload;
}

/**
 * Map CanvasCast event names to Meta standard event names
 */
const EVENT_NAME_MAP: Record<string, string> = {
  landing_view: 'PageView',
  demo_video_played: 'ViewContent',
  signup_completed: 'CompleteRegistration',
  video_generated: 'ViewContent',
  video_downloaded: 'AddToCart',
  checkout_started: 'InitiateCheckout',
  purchase_completed: 'Purchase',
  subscription_started: 'Subscribe',
  subscription_completed: 'Subscribe',
};

/**
 * Track an event client-side and prepare the payload for server-side tracking
 * Ensures the same event ID is used for both client and server
 *
 * @param eventName - The CanvasCast event name (e.g., 'purchase_completed')
 * @param clientProperties - Properties for client-side tracking (PostHog + Pixel)
 * @param userData - User data for server-side CAPI tracking
 * @param customData - Custom data for server-side CAPI tracking (optional, derived from clientProperties if not provided)
 * @returns Event ID and server payload for CAPI
 */
export function trackAndPrepareServerEvent(
  eventName: string,
  clientProperties: Record<string, any>,
  userData: ServerUserData,
  customData?: ServerCustomData
): TrackAndPrepareResult {
  // Generate a unique event ID
  const eventId = generateEventId();

  // Track to client-side (PostHog + Meta Pixel)
  trackEventWithMeta(eventName, {
    ...clientProperties,
    meta_event_id: eventId,
  });

  // Get Meta event name
  const metaEventName = EVENT_NAME_MAP[eventName] || eventName;

  // Derive custom data from client properties if not provided
  const derivedCustomData: ServerCustomData = customData || {
    value: clientProperties.amount ? clientProperties.amount / 100 : undefined,
    currency: clientProperties.currency || 'USD',
    contentIds: clientProperties.content_ids || (clientProperties.video_id ? [clientProperties.video_id] : undefined),
    contentType: clientProperties.content_type,
    contentName: clientProperties.content_name,
    numItems: clientProperties.credits || clientProperties.num_items,
    status: clientProperties.status,
    predictedLtv: clientProperties.predicted_ltv,
  };

  // Prepare server payload
  const serverPayload: ServerEventPayload = {
    eventName: metaEventName,
    eventId,
    eventTime: Math.floor(Date.now() / 1000),
    eventSourceUrl: typeof window !== 'undefined' ? window.location.href : undefined,
    userData: {
      ...userData,
      // Auto-detect Facebook cookies if in browser
      ...(typeof window !== 'undefined' && {
        fbp: getCookie('_fbp'),
        fbc: getCookie('_fbc'),
      }),
      // Auto-detect user agent if in browser
      ...(typeof window !== 'undefined' && {
        clientUserAgent: navigator.userAgent,
      }),
    },
    customData: derivedCustomData,
    actionSource: 'website',
  };

  return {
    eventId,
    serverPayload,
  };
}

/**
 * Track an event client-side and immediately send to server-side CAPI endpoint
 * This is a convenience method that combines trackAndPrepareServerEvent with the API call
 *
 * @param eventName - The CanvasCast event name
 * @param clientProperties - Properties for client-side tracking
 * @param userData - User data for server-side tracking
 * @param customData - Custom data for server-side tracking (optional)
 * @returns Promise with the CAPI response
 */
export async function trackDualWithCAPI(
  eventName: string,
  clientProperties: Record<string, any>,
  userData: ServerUserData,
  customData?: ServerCustomData
): Promise<{ success: boolean; eventId: string; error?: string }> {
  try {
    const { eventId, serverPayload } = trackAndPrepareServerEvent(
      eventName,
      clientProperties,
      userData,
      customData
    );

    // Send to CAPI endpoint
    const response = await fetch('/api/meta-capi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(serverPayload),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        eventId,
        error: error.error || 'Failed to track server-side event',
      };
    }

    return {
      success: true,
      eventId,
    };
  } catch (error) {
    return {
      success: false,
      eventId: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Helper to get a cookie value by name
 */
function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift();
  }
  return undefined;
}

/**
 * Helper to extract Meta event ID from Stripe metadata
 * Use this in webhook handlers to retrieve the event ID passed from client
 *
 * @param metadata - Stripe session or subscription metadata
 * @returns Event ID if found, or generates a new one
 */
export function extractOrGenerateEventId(metadata?: Record<string, any>): string {
  if (metadata && metadata.meta_event_id) {
    return metadata.meta_event_id;
  }
  // Generate new event ID for server-only events
  return generateEventId();
}

/**
 * Helper to add Meta event ID to Stripe metadata
 * Use this when creating Stripe checkout sessions
 *
 * @param existingMetadata - Existing metadata object
 * @param eventId - The Meta event ID to include
 * @returns Updated metadata object
 */
export function addEventIdToMetadata(
  existingMetadata: Record<string, any>,
  eventId: string
): Record<string, any> {
  return {
    ...existingMetadata,
    meta_event_id: eventId,
  };
}

/**
 * Export event ID generator for direct use
 */
export { generateEventId };
