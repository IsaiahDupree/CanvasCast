import posthog from 'posthog-js';

// Type definitions
export interface AnalyticsUser {
  id: string;
  email?: string;
  name?: string;
  plan?: string;
  [key: string]: any;
}

export interface AnalyticsEventProperties {
  [key: string]: any;
}

// PostHog client instance
let posthogInstance: typeof posthog | null = null;

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
 * Initialize PostHog analytics
 * Should be called once at app startup
 * Respects cookie consent preferences
 */
export function initPostHog(): void {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

  // Don't initialize if API key is missing
  if (!apiKey) {
    console.warn('PostHog API key not found. Analytics will not be tracked.');
    return;
  }

  // Don't initialize if already initialized
  if (posthogInstance) {
    return;
  }

  // Check cookie consent before initializing
  if (!checkAnalyticsConsent()) {
    console.log('Analytics disabled due to cookie preferences');
    return;
  }

  try {
    posthog.init(apiKey, {
      api_host: apiHost,
      loaded: (posthogClient) => {
        posthogInstance = posthogClient;

        // Enable debug mode in development
        if (process.env.NODE_ENV === 'development') {
          posthog.debug();
        }
      },
      // Capture page views automatically
      capture_pageview: true,
      // Capture page leave events
      capture_pageleave: true,
      // Enable session recording (optional)
      session_recording: {
        enabled: process.env.NEXT_PUBLIC_POSTHOG_SESSION_RECORDING === 'true',
      },
      // Respect Do Not Track
      respect_dnt: true,
      // Persistence mode
      persistence: 'localStorage+cookie',
      // Cross-subdomain cookie (if needed)
      cross_subdomain_cookie: false,
    });

    posthogInstance = posthog;
  } catch (error) {
    console.error('Failed to initialize PostHog:', error);
  }
}

/**
 * Track a page view event
 */
export function trackPageView(path: string, properties?: AnalyticsEventProperties): void {
  if (!posthogInstance) {
    return;
  }

  try {
    posthog.capture('$pageview', {
      path,
      ...properties,
    });
  } catch (error) {
    console.error('Failed to track page view:', error);
  }
}

/**
 * Identify a user for analytics
 */
export function identifyUser(userId: string, properties?: AnalyticsEventProperties): void {
  if (!userId || !posthogInstance) {
    return;
  }

  try {
    posthog.identify(userId, properties || {});
  } catch (error) {
    console.error('Failed to identify user:', error);
  }
}

/**
 * Track a custom event
 */
export function trackEvent(eventName: string, properties?: AnalyticsEventProperties): void {
  if (!posthogInstance) {
    return;
  }

  try {
    posthog.capture(eventName, properties || {});
  } catch (error) {
    console.error('Failed to track event:', error);
  }
}

/**
 * Reset analytics (e.g., on logout)
 */
export function resetAnalytics(): void {
  if (!posthogInstance) {
    return;
  }

  try {
    posthog.reset();
  } catch (error) {
    console.error('Failed to reset analytics:', error);
  }
}

/**
 * Get the current PostHog instance
 */
export function getPostHogInstance(): typeof posthog | null {
  return posthogInstance;
}

/**
 * Reset PostHog instance (for testing purposes)
 * @internal
 */
export function _resetPostHogInstance(): void {
  posthogInstance = null;
}

// Common event names (for consistency)
export const ANALYTICS_EVENTS = {
  // Landing page
  LANDING_VIEWED: 'landing_viewed',

  // Signup/Login
  SIGNUP_STARTED: 'signup_started',
  SIGNUP_COMPLETED: 'signup_completed',
  LOGIN_STARTED: 'login_started',
  LOGIN_COMPLETED: 'login_completed',

  // Video creation
  VIDEO_CREATION_STARTED: 'video_creation_started',
  VIDEO_CREATION_COMPLETED: 'video_creation_completed',
  VIDEO_CREATION_FAILED: 'video_creation_failed',
  VIDEO_DOWNLOADED: 'video_downloaded',

  // Credits
  CREDITS_PURCHASED: 'credits_purchased',
  CREDITS_LOW: 'credits_low',
  CREDITS_DEPLETED: 'credits_depleted',

  // Subscription
  SUBSCRIPTION_STARTED: 'subscription_started',
  SUBSCRIPTION_COMPLETED: 'subscription_completed',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
} as const;

// Funnel event names for conversion tracking
// Funnel: landing → signup → first_video → paid_conversion
export const FUNNEL_EVENTS = {
  LANDING_VIEWED: 'funnel_landing_viewed',
  SIGNUP_COMPLETED: 'funnel_signup_completed',
  FIRST_VIDEO_CREATED: 'funnel_first_video_created',
  PAID_CONVERSION: 'funnel_paid_conversion',
} as const;

// Map funnel events to their stage names
const FUNNEL_STAGE_MAP: Record<string, string> = {
  [FUNNEL_EVENTS.LANDING_VIEWED]: 'landing',
  [FUNNEL_EVENTS.SIGNUP_COMPLETED]: 'signup',
  [FUNNEL_EVENTS.FIRST_VIDEO_CREATED]: 'first_video',
  [FUNNEL_EVENTS.PAID_CONVERSION]: 'paid_conversion',
};

/**
 * Get funnel stage metadata for an event
 */
export function getFunnelEventProperties(eventName: string): { funnel_stage: string } {
  const stage = FUNNEL_STAGE_MAP[eventName] || 'unknown';
  return {
    funnel_stage: stage,
  };
}

/**
 * Track a funnel conversion event
 * Automatically adds funnel_stage and timestamp metadata
 */
export function trackFunnelEvent(
  eventName: string,
  properties?: AnalyticsEventProperties
): void {
  if (!posthogInstance) {
    return;
  }

  try {
    const funnelProps = getFunnelEventProperties(eventName);
    const timestamp = new Date().toISOString();

    posthog.capture(eventName, {
      ...funnelProps,
      ...properties,
      timestamp,
    });
  } catch (error) {
    console.error('Failed to track funnel event:', error);
  }
}
