/**
 * Meta Conversions API (CAPI) Client (META-004)
 * Implements server-side event tracking for Facebook Ads
 *
 * Features:
 * - Server-side event tracking for better reliability
 * - Event deduplication with client-side Pixel events
 * - PII hashing for user privacy
 * - Support for all standard Meta events
 *
 * Usage:
 * ```typescript
 * await trackServerSideEvent({
 *   eventName: 'Purchase',
 *   eventId: 'evt_123',
 *   eventTime: Math.floor(Date.now() / 1000),
 *   eventSourceUrl: 'https://example.com/checkout',
 *   userData: {
 *     email: 'user@example.com',
 *     clientIpAddress: req.ip,
 *     clientUserAgent: req.headers['user-agent'],
 *   },
 *   customData: {
 *     value: 29.99,
 *     currency: 'USD',
 *   },
 *   actionSource: 'website'
 * });
 * ```
 */

import crypto from 'crypto';
import {
  FacebookAdsApi,
  ServerEvent,
  EventRequest,
  UserData,
  CustomData,
} from 'facebook-nodejs-business-sdk';

/**
 * User data for Meta CAPI events
 */
export interface MetaUserData {
  email?: string;
  phone?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
  fbp?: string; // Facebook browser cookie
  fbc?: string; // Facebook click ID
}

/**
 * Custom data for Meta CAPI events
 */
export interface MetaCustomData {
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
 * Meta CAPI event data
 */
export interface MetaEventData {
  eventName: string;
  eventId: string;
  eventTime: number; // Unix timestamp in seconds
  eventSourceUrl?: string;
  userData: MetaUserData;
  customData?: MetaCustomData;
  actionSource: 'website' | 'email' | 'app';
}

/**
 * Meta CAPI response
 */
export interface MetaEventResponse {
  success: boolean;
  eventsReceived?: number;
  messages?: string[];
  error?: string;
}

// Initialize Meta CAPI client
let isInitialized = false;

/**
 * Initialize the Meta Conversions API client
 * Should be called once at app startup
 */
export function initMetaCAPI(accessToken: string, pixelId: string): void {
  if (isInitialized) {
    return;
  }

  if (!accessToken || !pixelId) {
    console.warn('Meta CAPI credentials not found. Server-side tracking disabled.');
    return;
  }

  try {
    FacebookAdsApi.init(accessToken);
    isInitialized = true;
    console.log('Meta CAPI initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Meta CAPI:', error);
  }
}

/**
 * Hash user data for privacy (SHA256)
 * Normalizes the data before hashing (lowercase, trim)
 *
 * @param data - The data to hash (email, phone, etc.)
 * @returns SHA256 hash of the normalized data
 */
export function hashUserData(data: string): string {
  if (!data) {
    return '';
  }

  // Normalize: lowercase and trim
  const normalized = data.toLowerCase().trim();

  // Hash with SHA256
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Track a server-side event using Meta Conversions API
 *
 * @param eventData - The event data to send
 * @returns Promise with the event response
 */
export async function trackServerSideEvent(
  eventData: MetaEventData
): Promise<MetaEventResponse> {
  if (!isInitialized) {
    return {
      success: false,
      error: 'Meta CAPI not initialized',
    };
  }

  const pixelId = process.env.META_PIXEL_ID;
  if (!pixelId) {
    return {
      success: false,
      error: 'Meta Pixel ID not configured',
    };
  }

  try {
    // Create user data with hashed PII
    const userData = new UserData();

    if (eventData.userData.email) {
      userData.setEmail(hashUserData(eventData.userData.email));
    }

    if (eventData.userData.phone) {
      userData.setPhone(hashUserData(eventData.userData.phone));
    }

    if (eventData.userData.clientIpAddress) {
      userData.setClientIpAddress(eventData.userData.clientIpAddress);
    }

    if (eventData.userData.clientUserAgent) {
      userData.setClientUserAgent(eventData.userData.clientUserAgent);
    }

    if (eventData.userData.fbp) {
      userData.setFbp(eventData.userData.fbp);
    }

    if (eventData.userData.fbc) {
      userData.setFbc(eventData.userData.fbc);
    }

    // Create custom data
    const customData = new CustomData();

    if (eventData.customData) {
      if (eventData.customData.value !== undefined) {
        customData.setValue(eventData.customData.value);
      }

      if (eventData.customData.currency) {
        customData.setCurrency(eventData.customData.currency);
      }

      if (eventData.customData.contentIds) {
        customData.setContentIds(eventData.customData.contentIds);
      }

      if (eventData.customData.contentType) {
        customData.setContentType(eventData.customData.contentType);
      }

      if (eventData.customData.numItems !== undefined) {
        customData.setNumItems(eventData.customData.numItems);
      }
    }

    // Create server event
    const serverEvent = new ServerEvent();
    serverEvent
      .setEventName(eventData.eventName)
      .setEventTime(eventData.eventTime)
      .setUserData(userData)
      .setCustomData(customData)
      .setActionSource(eventData.actionSource);

    // Set event ID for deduplication with client-side Pixel events
    if (eventData.eventId) {
      serverEvent.setEventId(eventData.eventId);
    }

    // Set event source URL if provided
    if (eventData.eventSourceUrl) {
      serverEvent.setEventSourceUrl(eventData.eventSourceUrl);
    }

    // Create and send event request
    const eventRequest = new EventRequest(
      process.env.META_ACCESS_TOKEN || '',
      pixelId
    );

    eventRequest.setEvents([serverEvent]);

    const response = await eventRequest.execute();

    return {
      success: true,
      eventsReceived: response.events_received,
      messages: response.messages,
    };
  } catch (error) {
    console.error('Failed to track Meta CAPI event:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Batch track multiple server-side events
 *
 * @param events - Array of events to track
 * @returns Promise with the batch response
 */
export async function trackServerSideEventsBatch(
  events: MetaEventData[]
): Promise<MetaEventResponse> {
  if (!isInitialized) {
    return {
      success: false,
      error: 'Meta CAPI not initialized',
    };
  }

  const pixelId = process.env.META_PIXEL_ID;
  if (!pixelId) {
    return {
      success: false,
      error: 'Meta Pixel ID not configured',
    };
  }

  try {
    const serverEvents = events.map((eventData) => {
      // Create user data
      const userData = new UserData();

      if (eventData.userData.email) {
        userData.setEmail(hashUserData(eventData.userData.email));
      }

      if (eventData.userData.phone) {
        userData.setPhone(hashUserData(eventData.userData.phone));
      }

      if (eventData.userData.clientIpAddress) {
        userData.setClientIpAddress(eventData.userData.clientIpAddress);
      }

      if (eventData.userData.clientUserAgent) {
        userData.setClientUserAgent(eventData.userData.clientUserAgent);
      }

      if (eventData.userData.fbp) {
        userData.setFbp(eventData.userData.fbp);
      }

      if (eventData.userData.fbc) {
        userData.setFbc(eventData.userData.fbc);
      }

      // Create custom data
      const customData = new CustomData();

      if (eventData.customData) {
        if (eventData.customData.value !== undefined) {
          customData.setValue(eventData.customData.value);
        }

        if (eventData.customData.currency) {
          customData.setCurrency(eventData.customData.currency);
        }

        if (eventData.customData.contentIds) {
          customData.setContentIds(eventData.customData.contentIds);
        }

        if (eventData.customData.contentType) {
          customData.setContentType(eventData.customData.contentType);
        }

        if (eventData.customData.numItems !== undefined) {
          customData.setNumItems(eventData.customData.numItems);
        }
      }

      // Create server event
      const serverEvent = new ServerEvent();
      serverEvent
        .setEventName(eventData.eventName)
        .setEventTime(eventData.eventTime)
        .setUserData(userData)
        .setCustomData(customData)
        .setActionSource(eventData.actionSource);

      if (eventData.eventId) {
        serverEvent.setEventId(eventData.eventId);
      }

      if (eventData.eventSourceUrl) {
        serverEvent.setEventSourceUrl(eventData.eventSourceUrl);
      }

      return serverEvent;
    });

    // Create and send batch event request
    const eventRequest = new EventRequest(
      process.env.META_ACCESS_TOKEN || '',
      pixelId
    );

    eventRequest.setEvents(serverEvents);

    const response = await eventRequest.execute();

    return {
      success: true,
      eventsReceived: response.events_received,
      messages: response.messages,
    };
  } catch (error) {
    console.error('Failed to track Meta CAPI batch events:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Helper to extract Meta cookies from request headers
 */
export function extractMetaCookies(cookieHeader?: string): {
  fbp?: string;
  fbc?: string;
} {
  if (!cookieHeader) {
    return {};
  }

  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach((cookie) => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookies[name] = value;
    }
  });

  return {
    fbp: cookies._fbp,
    fbc: cookies._fbc,
  };
}
