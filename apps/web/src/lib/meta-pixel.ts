/**
 * Meta Pixel (Facebook Pixel) Integration (META-001)
 * Provides client-side tracking for Facebook advertising and analytics
 *
 * Features:
 * - Pixel initialization with cookie consent checking
 * - Standard event tracking (PageView, Purchase, etc.)
 * - Custom event tracking
 * - Event deduplication support with eventID
 *
 * Usage:
 * ```typescript
 * // Initialize once at app startup
 * initMetaPixel(process.env.NEXT_PUBLIC_META_PIXEL_ID);
 *
 * // Track events
 * trackMetaEvent('PageView', {});
 * trackMetaEvent('Purchase', { value: 29.99, currency: 'USD' }, 'evt_123');
 * ```
 */

// Declare fbq function type for TypeScript
declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: (...args: any[]) => void;
  }
}

// Track if Meta Pixel has been initialized
let isInitialized = false;

/**
 * Check if analytics is enabled based on cookie consent
 */
function checkAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const stored = localStorage.getItem('cookie-consent');
    if (!stored) {
      // No consent given yet - don't track
      return false;
    }

    const preferences = JSON.parse(stored);
    return preferences.analytics === true;
  } catch {
    return false;
  }
}

/**
 * Initialize Meta Pixel
 * Should be called once at app startup
 * Respects cookie consent preferences
 *
 * @param pixelId - The Meta Pixel ID from Facebook Events Manager
 */
export function initMetaPixel(pixelId: string): void {
  // Don't initialize if pixel ID is missing
  if (!pixelId || pixelId.trim() === '') {
    console.warn('Meta Pixel ID not found. Meta Pixel tracking will not be available.');
    return;
  }

  // Don't initialize if already initialized
  if (isInitialized) {
    return;
  }

  // Check cookie consent before initializing
  if (!checkAnalyticsConsent()) {
    console.log('Meta Pixel disabled due to cookie preferences');
    return;
  }

  // Only initialize in browser environment
  if (typeof window === 'undefined') {
    return;
  }

  try {
    // Initialize fbq function and queue
    const fbq: any = function (...args: any[]) {
      if (fbq.callMethod) {
        fbq.callMethod.apply(fbq, args);
      } else {
        fbq.queue.push(args);
      }
    };

    // If fbq already exists, don't override it
    if (!window.fbq) {
      window.fbq = fbq;
    }

    // Initialize queue and version
    if (!window._fbq) {
      window._fbq = fbq;
    }
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];

    // Load the Meta Pixel script
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode?.insertBefore(script, firstScript);

    // Initialize the pixel
    window.fbq('init', pixelId);

    isInitialized = true;
  } catch (error) {
    console.error('Failed to initialize Meta Pixel:', error);
  }
}

/**
 * Check if Meta Pixel is loaded and ready to track events
 *
 * @returns true if Meta Pixel is loaded, false otherwise
 */
export function isMetaPixelLoaded(): boolean {
  return typeof window !== 'undefined' && typeof window.fbq === 'function';
}

/**
 * Track a Meta Pixel event
 *
 * @param eventName - The event name (e.g., 'PageView', 'Purchase', 'CompleteRegistration')
 * @param properties - Event properties (e.g., { value: 29.99, currency: 'USD' })
 * @param eventId - Optional event ID for deduplication with CAPI
 */
export function trackMetaEvent(
  eventName: string,
  properties?: Record<string, any>,
  eventId?: string
): void {
  if (!isMetaPixelLoaded()) {
    return;
  }

  try {
    if (eventId) {
      // Include eventID for deduplication with server-side CAPI events
      window.fbq!('track', eventName, properties || {}, { eventID: eventId });
    } else {
      window.fbq!('track', eventName, properties || {});
    }
  } catch (error) {
    console.error('Failed to track Meta Pixel event:', error);
  }
}

/**
 * Track a custom Meta Pixel event
 * Custom events are not part of the standard Facebook event set
 *
 * @param eventName - The custom event name
 * @param properties - Event properties
 * @param eventId - Optional event ID for deduplication with CAPI
 */
export function trackCustomMetaEvent(
  eventName: string,
  properties?: Record<string, any>,
  eventId?: string
): void {
  if (!isMetaPixelLoaded()) {
    return;
  }

  try {
    if (eventId) {
      window.fbq!('trackCustom', eventName, properties || {}, { eventID: eventId });
    } else {
      window.fbq!('trackCustom', eventName, properties || {});
    }
  } catch (error) {
    console.error('Failed to track custom Meta Pixel event:', error);
  }
}

/**
 * Reset Meta Pixel initialization state (for testing purposes)
 * @internal
 */
export function _resetMetaPixelState(): void {
  isInitialized = false;
  if (typeof window !== 'undefined') {
    delete window.fbq;
    delete window._fbq;
  }
}

// Meta Pixel standard event names (for consistency)
export const META_EVENTS = {
  PAGE_VIEW: 'PageView',
  VIEW_CONTENT: 'ViewContent',
  SEARCH: 'Search',
  ADD_TO_CART: 'AddToCart',
  ADD_TO_WISHLIST: 'AddToWishlist',
  INITIATE_CHECKOUT: 'InitiateCheckout',
  ADD_PAYMENT_INFO: 'AddPaymentInfo',
  PURCHASE: 'Purchase',
  LEAD: 'Lead',
  COMPLETE_REGISTRATION: 'CompleteRegistration',
  CONTACT: 'Contact',
  CUSTOMIZE_PRODUCT: 'CustomizeProduct',
  DONATE: 'Donate',
  FIND_LOCATION: 'FindLocation',
  SCHEDULE: 'Schedule',
  START_TRIAL: 'StartTrial',
  SUBMIT_APPLICATION: 'SubmitApplication',
  SUBSCRIBE: 'Subscribe',
} as const;
