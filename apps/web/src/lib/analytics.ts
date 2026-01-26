import posthog from 'posthog-js';
import { trackEventWithMeta } from './meta-pixel-mapper';
import {
  identifyUserForAudience,
  getUserSegments,
  AudienceSegment,
  type UserAudienceData,
} from './custom-audiences';

// Type definitions
export interface AnalyticsUser {
  id: string;
  email?: string;
  name?: string;
  plan?: string;
  // Audience segmentation fields (META-007)
  totalSpent?: number;
  videosGenerated?: number;
  hasTrialCredits?: boolean;
  hasPurchased?: boolean;
  hasSubscription?: boolean;
  daysSinceLastActive?: number;
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
 * Now includes automatic audience segmentation for Meta Pixel (META-007)
 */
export async function identifyUser(userId: string, properties?: AnalyticsEventProperties): Promise<void> {
  if (!userId || !posthogInstance) {
    return;
  }

  try {
    // Identify in PostHog
    posthog.identify(userId, properties || {});

    // META-007: Automatically identify user for custom audiences in Meta Pixel
    // Extract audience data from user properties
    const audienceData: UserAudienceData = {
      hasTrialCredits: properties?.hasTrialCredits,
      hasPurchased: properties?.hasPurchased,
      totalSpent: properties?.totalSpent,
      videosGenerated: properties?.videosGenerated,
      daysSinceLastActive: properties?.daysSinceLastActive,
      hasSubscription: properties?.hasSubscription,
    };

    // Calculate user segments
    const segments = getUserSegments(audienceData);

    // Calculate lifetime value from totalSpent (convert cents to dollars)
    const ltv = properties?.totalSpent ? properties.totalSpent / 100 : undefined;

    // Identify user for Meta Pixel custom audiences (async)
    await identifyUserForAudience(userId, {
      email: properties?.email as string | undefined,
      plan: properties?.plan as string | undefined,
      ltv,
      segments,
    });
  } catch (error) {
    console.error('Failed to identify user:', error);
  }
}

/**
 * GDP-009: PostHog Identity Stitching
 *
 * Identify a user in PostHog for identity stitching.
 * This function is specifically for stitching anonymous sessions to identified users.
 * Call this on login/signup to link pre-auth activity to the user.
 *
 * @param userId - The Supabase user ID (person_id)
 * @param properties - User properties (email, name, etc.)
 */
export async function identifyUserForPostHog(
  userId: string,
  properties?: AnalyticsEventProperties
): Promise<void> {
  // Don't identify if user ID is missing
  if (!userId) {
    return;
  }

  // Don't identify if PostHog is not initialized
  if (!posthogInstance) {
    return;
  }

  try {
    // Call PostHog identify to stitch anonymous session to user
    // This automatically links any pre-login activity to this user
    posthog.identify(userId, properties || {});
  } catch (error) {
    console.error('Failed to identify user for PostHog:', error);
  }
}

/**
 * Track a custom event (PostHog only)
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
 * Track an event to both PostHog and Meta Pixel (META-003)
 * Use this for key conversion events that should be tracked in Facebook Ads
 * Automatically maps CanvasCast events to Meta standard events
 *
 * @param eventName - The CanvasCast event name
 * @param properties - Event properties
 */
export function trackEventDual(
  eventName: string,
  properties?: AnalyticsEventProperties
): void {
  trackEventWithMeta(eventName, properties);
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

/**
 * Extract UTM parameters from URL search params
 * Returns an object containing all UTM parameters found
 */
export function extractUtmParams(searchParams: URLSearchParams): Record<string, string> {
  const utmParams: Record<string, string> = {};
  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

  utmKeys.forEach((key) => {
    const value = searchParams.get(key);
    if (value) {
      utmParams[key] = value;
    }
  });

  return utmParams;
}

/**
 * Track acquisition events (TRACK-002)
 * These events track the user's journey from landing to conversion
 * Always preserves UTM parameters for attribution tracking
 */
export function trackAcquisitionEvent(
  eventName: string,
  properties?: AnalyticsEventProperties
): void {
  if (!posthogInstance) {
    return;
  }

  try {
    posthog.capture(eventName, properties || {});
  } catch (error) {
    console.error('Failed to track acquisition event:', error);
  }
}

/**
 * Track activation events (TRACK-003)
 * These events track signup, login, and activation milestones
 * Includes method (email/oauth), user context, and draft status
 */
export function trackActivationEvent(
  eventName: string,
  properties?: AnalyticsEventProperties
): void {
  if (!posthogInstance) {
    return;
  }

  try {
    posthog.capture(eventName, properties || {});
  } catch (error) {
    console.error('Failed to track activation event:', error);
  }
}

/**
 * Track core value events (TRACK-004)
 * These events track product-specific value delivery moments:
 * - project_created: User creates a new video project
 * - prompt_submitted: User submits prompt for video generation
 * - video_generated: Video generation completes (success or failure)
 * - video_downloaded: User downloads their generated video
 * - script_edited: User edits the generated script
 * - voice_selected: User selects a voice option
 */
export function trackCoreValueEvent(
  eventName: string,
  properties?: AnalyticsEventProperties
): void {
  if (!posthogInstance) {
    return;
  }

  try {
    posthog.capture(eventName, properties || {});
  } catch (error) {
    console.error('Failed to track core value event:', error);
  }
}

/**
 * Track monetization events (TRACK-005)
 * These events track revenue-generating actions and subscription lifecycle:
 * - checkout_started: User initiates checkout process for credits or subscription
 * - purchase_completed: One-time credit purchase completed successfully
 * - subscription_started: User initiates subscription checkout
 * - subscription_completed: Subscription payment successful
 * - subscription_cancelled: User cancels their subscription
 * - subscription_renewed: Subscription automatically renewed
 *
 * Properties should include:
 * - product_type: 'credits' | 'subscription'
 * - amount: Price in cents
 * - currency: Currency code (e.g., 'USD')
 * - revenue: Revenue in dollars (for PostHog)
 * - For credits: credits, product_name
 * - For subscriptions: plan, interval, credits_per_month, subscription_id
 * - For purchases: transaction_id, payment_method
 */
export function trackMonetizationEvent(
  eventName: string,
  properties?: AnalyticsEventProperties
): void {
  if (!posthogInstance) {
    return;
  }

  try {
    posthog.capture(eventName, properties || {});
  } catch (error) {
    console.error('Failed to track monetization event:', error);
  }
}

/**
 * Track retention events (TRACK-006)
 * These events track user return behavior and engagement patterns:
 * - return_session: User visits the app after 24+ hours since last visit
 * - returning_user: User performs a core action again (creates project, generates video, etc.)
 *
 * Properties should include:
 * - user_id: The authenticated user's ID
 * - For return_session: days_since_last_visit, total_sessions, last_action, session_start
 * - For returning_user: action (e.g., 'project_created', 'video_generated'),
 *   days_since_signup, total_projects, credits_remaining
 */
export function trackRetentionEvent(
  eventName: string,
  properties?: AnalyticsEventProperties
): void {
  if (!posthogInstance) {
    return;
  }

  try {
    posthog.capture(eventName, properties || {});
  } catch (error) {
    console.error('Failed to track retention event:', error);
  }
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

// Acquisition event names (TRACK-002)
export const ACQUISITION_EVENTS = {
  LANDING_VIEW: 'landing_view',
  CTA_CLICK: 'cta_click',
  PRICING_VIEW: 'pricing_view',
} as const;

// Activation event names (TRACK-003)
export const ACTIVATION_EVENTS = {
  SIGNUP_START: 'signup_start',
  LOGIN_SUCCESS: 'login_success',
  ACTIVATION_COMPLETE: 'activation_complete',
} as const;

// Core value event names (TRACK-004)
export const CORE_VALUE_EVENTS = {
  PROJECT_CREATED: 'project_created',
  PROMPT_SUBMITTED: 'prompt_submitted',
  VIDEO_GENERATED: 'video_generated',
  VIDEO_DOWNLOADED: 'video_downloaded',
  SCRIPT_EDITED: 'script_edited',
  VOICE_SELECTED: 'voice_selected',
} as const;

// Monetization event names (TRACK-005)
export const MONETIZATION_EVENTS = {
  CHECKOUT_STARTED: 'checkout_started',
  PURCHASE_COMPLETED: 'purchase_completed',
  SUBSCRIPTION_STARTED: 'subscription_started',
  SUBSCRIPTION_COMPLETED: 'subscription_completed',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  SUBSCRIPTION_RENEWED: 'subscription_renewed',
} as const;

// Retention event names (TRACK-006)
export const RETENTION_EVENTS = {
  RETURN_SESSION: 'return_session',
  RETURNING_USER: 'returning_user',
} as const;

// Error & Performance event names (TRACK-007)
export const ERROR_PERFORMANCE_EVENTS = {
  ERROR_OCCURRED: 'error_occurred',
  API_FAILURE: 'api_failure',
  WEB_VITAL: 'web_vital',
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

/**
 * Track an error event (TRACK-007)
 * Captures error details including message, type, stack trace, and optional context
 */
export function trackError(
  error: Error | string,
  properties?: AnalyticsEventProperties
): void {
  if (!posthogInstance) {
    return;
  }

  try {
    let errorData: Record<string, any> = {
      ...properties,
    };

    if (error instanceof Error) {
      errorData.error_message = error.message;
      errorData.error_type = error.name;
      errorData.error_stack = error.stack;
    } else if (typeof error === 'string') {
      errorData.error_message = error;
      errorData.error_type = 'String';
    } else {
      errorData.error_message = String(error);
      errorData.error_type = 'Unknown';
    }

    posthog.capture(ERROR_PERFORMANCE_EVENTS.ERROR_OCCURRED, errorData);
  } catch (err) {
    console.error('Failed to track error:', err);
  }
}

/**
 * API Failure tracking properties
 */
export interface ApiFailureProperties {
  endpoint: string;
  method: string;
  statusCode: number;
  errorMessage?: string;
  responseTime?: number;
  requestId?: string;
}

/**
 * Track API failure events (TRACK-007)
 * Captures failed API calls with endpoint, status code, and timing information
 */
export function trackApiFailure(properties: ApiFailureProperties): void {
  if (!posthogInstance) {
    return;
  }

  try {
    // Categorize error type based on status code
    let errorType = 'unknown_error';
    if (properties.statusCode >= 400 && properties.statusCode < 500) {
      errorType = 'client_error';
    } else if (properties.statusCode >= 500) {
      errorType = 'server_error';
    }

    posthog.capture(ERROR_PERFORMANCE_EVENTS.API_FAILURE, {
      endpoint: properties.endpoint,
      method: properties.method,
      status_code: properties.statusCode,
      error_type: errorType,
      error_message: properties.errorMessage,
      response_time: properties.responseTime,
      request_id: properties.requestId,
    });
  } catch (error) {
    console.error('Failed to track API failure:', error);
  }
}

/**
 * Initialize Core Web Vitals tracking (TRACK-007)
 * Tracks performance metrics: CLS, FID, FCP, LCP, TTFB, INP
 */
export function initWebVitals(): void {
  if (!posthogInstance) {
    return;
  }

  // Only run in browser environment
  if (typeof window === 'undefined') {
    return;
  }

  try {
    // Use synchronous import for web-vitals (works in both test and browser)
    const { onCLS, onFID, onFCP, onLCP, onTTFB, onINP } = require('web-vitals');

    // Track Cumulative Layout Shift
    onCLS((metric: any) => {
      posthog.capture(ERROR_PERFORMANCE_EVENTS.WEB_VITAL, {
        metric_name: metric.name,
        metric_value: metric.value,
        metric_rating: metric.rating,
        metric_delta: metric.delta,
      });
    });

    // Track First Input Delay
    onFID((metric: any) => {
      posthog.capture(ERROR_PERFORMANCE_EVENTS.WEB_VITAL, {
        metric_name: metric.name,
        metric_value: metric.value,
        metric_rating: metric.rating,
        metric_delta: metric.delta,
      });
    });

    // Track First Contentful Paint
    onFCP((metric: any) => {
      posthog.capture(ERROR_PERFORMANCE_EVENTS.WEB_VITAL, {
        metric_name: metric.name,
        metric_value: metric.value,
        metric_rating: metric.rating,
        metric_delta: metric.delta,
      });
    });

    // Track Largest Contentful Paint
    onLCP((metric: any) => {
      posthog.capture(ERROR_PERFORMANCE_EVENTS.WEB_VITAL, {
        metric_name: metric.name,
        metric_value: metric.value,
        metric_rating: metric.rating,
        metric_delta: metric.delta,
      });
    });

    // Track Time to First Byte
    onTTFB((metric: any) => {
      posthog.capture(ERROR_PERFORMANCE_EVENTS.WEB_VITAL, {
        metric_name: metric.name,
        metric_value: metric.value,
        metric_rating: metric.rating,
        metric_delta: metric.delta,
      });
    });

    // Track Interaction to Next Paint
    onINP((metric: any) => {
      posthog.capture(ERROR_PERFORMANCE_EVENTS.WEB_VITAL, {
        metric_name: metric.name,
        metric_value: metric.value,
        metric_rating: metric.rating,
        metric_delta: metric.delta,
      });
    });
  } catch (error) {
    console.error('Failed to initialize web vitals:', error);
  }
}

// Re-export custom audience utilities for convenience (META-007)
export { AudienceSegment, getUserSegments, type UserAudienceData } from './custom-audiences';

/**
 * META-003: Meta Pixel Event Mapping
 *
 * The following CanvasCast events are automatically mapped to Meta Pixel standard events:
 *
 * - landing_view → PageView
 * - demo_video_played → ViewContent (content_type: 'demo')
 * - signup_completed → CompleteRegistration
 * - video_generated → ViewContent (content_type: 'video')
 * - video_downloaded → AddToCart
 * - checkout_started → InitiateCheckout
 * - purchase_completed → Purchase
 * - subscription_started → Subscribe
 * - subscription_completed → Subscribe
 *
 * Use trackEventDual() to track these events to both PostHog and Meta Pixel.
 * The mapper automatically:
 * - Converts event names to Meta standard events
 * - Transforms properties (e.g., amount in cents to value in dollars)
 * - Adds required parameters (currency, content_type, etc.)
 * - Generates event IDs for deduplication with CAPI
 */
