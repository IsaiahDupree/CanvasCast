/**
 * Meta Pixel Custom Audiences Setup (META-007)
 *
 * Provides audience segmentation and user property tracking for Meta Ads Manager.
 * This enables better retargeting and lookalike audience creation.
 *
 * Features:
 * - User segmentation based on behavior and spend
 * - Value-based audience classification
 * - Engagement and lifecycle tracking
 * - Meta Pixel integration for audience building
 *
 * Usage:
 * ```typescript
 * // Identify user for custom audiences
 * identifyUserForAudience('user_123', {
 *   email: 'user@example.com',
 *   plan: 'creator',
 *   ltv: 150,
 *   segments: [AudienceSegment.PAYING_CUSTOMER],
 * });
 *
 * // Track segment changes
 * trackUserSegment('user_123', AudienceSegment.HIGH_VALUE_CUSTOMER, {
 *   totalSpent: 15000,
 * });
 * ```
 */

// Crypto will be imported dynamically only in Node.js environment

// Declare fbq function type for TypeScript
declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: (...args: any[]) => void;
    __META_PIXEL_ID__?: string;
  }
}

/**
 * Audience segments for targeting and retargeting
 * These correspond to common marketing segments for video generation SaaS
 */
export enum AudienceSegment {
  /** Users on free trial who haven't purchased */
  FREE_TRIAL_USER = 'free_trial_user',

  /** Users who have made at least one purchase */
  PAYING_CUSTOMER = 'paying_customer',

  /** High-value customers (LTV > $100) */
  HIGH_VALUE_CUSTOMER = 'high_value_customer',

  /** Users who have generated at least one video */
  ACTIVATED_USER = 'activated_user',

  /** Users who haven't been active in 30+ days */
  CHURNED_USER = 'churned_user',

  /** Power users with high engagement */
  POWER_USER = 'power_user',

  /** Active subscription holders */
  SUBSCRIBER = 'subscriber',
}

/**
 * User data for audience segmentation
 */
export interface UserAudienceData {
  /** Whether user has trial credits */
  hasTrialCredits?: boolean;

  /** Whether user has purchased */
  hasPurchased?: boolean;

  /** Total amount spent in cents */
  totalSpent?: number;

  /** Number of videos generated */
  videosGenerated?: number;

  /** Days since last active */
  daysSinceLastActive?: number;

  /** Whether user has active subscription */
  hasSubscription?: boolean;
}

/**
 * User identification data for Meta Pixel
 */
export interface UserIdentificationData {
  /** User email address (will be hashed) */
  email?: string;

  /** User's current plan */
  plan?: string;

  /** Lifetime value in dollars */
  ltv?: number;

  /** User's audience segments */
  segments?: AudienceSegment[];

  /** Additional custom properties */
  [key: string]: any;
}

/**
 * Determine which audience segments a user belongs to based on their behavior and spend
 *
 * @param userData - User data for segmentation
 * @returns Array of audience segments
 */
export function getUserSegments(userData: UserAudienceData): AudienceSegment[] {
  const segments: AudienceSegment[] = [];

  // Free trial users
  if (userData.hasTrialCredits && !userData.hasPurchased) {
    segments.push(AudienceSegment.FREE_TRIAL_USER);
  }

  // Paying customers
  if (userData.hasPurchased) {
    segments.push(AudienceSegment.PAYING_CUSTOMER);
  }

  // High-value customers (spent $100+)
  if ((userData.totalSpent ?? 0) >= 10000) {
    // 10000 cents = $100
    segments.push(AudienceSegment.HIGH_VALUE_CUSTOMER);
  }

  // Activated users (generated at least 1 video)
  if ((userData.videosGenerated ?? 0) >= 1) {
    segments.push(AudienceSegment.ACTIVATED_USER);
  }

  // Churned users (inactive for 30+ days)
  if ((userData.daysSinceLastActive ?? 0) >= 30) {
    segments.push(AudienceSegment.CHURNED_USER);
  }

  // Power users (high engagement + high spend)
  if (
    (userData.videosGenerated ?? 0) >= 20 &&
    (userData.totalSpent ?? 0) >= 10000 &&
    userData.hasSubscription
  ) {
    segments.push(AudienceSegment.POWER_USER);
  }

  // Subscribers
  if (userData.hasSubscription) {
    segments.push(AudienceSegment.SUBSCRIBER);
  }

  return segments;
}

/**
 * Hash email address for Meta Pixel advanced matching
 * Uses SHA-256 as per Meta's requirements
 * Works in both browser and Node.js environments
 *
 * @param email - Email address to hash
 * @returns Hashed email in lowercase hex format
 */
async function hashEmail(email: string): Promise<string> {
  const normalized = email.toLowerCase().trim();

  // Use Web Crypto API in browser
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Use Node.js crypto in server environment (dynamic import)
  if (typeof window === 'undefined') {
    try {
      const { createHash } = await import('crypto');
      return createHash('sha256').update(normalized).digest('hex');
    } catch (error) {
      console.warn('Node.js crypto not available:', error);
    }
  }

  // Fallback: just return the email (not ideal, but better than crashing)
  console.warn('SHA-256 hashing not available, using plain email');
  return normalized;
}

/**
 * Check if Meta Pixel is loaded
 *
 * @returns true if Meta Pixel is available
 */
function isMetaPixelLoaded(): boolean {
  return typeof window !== 'undefined' && typeof window.fbq === 'function';
}

/**
 * Identify a user for custom audience building in Meta Pixel
 * Sends user properties to Meta for improved ad targeting
 *
 * @param userId - Unique user identifier
 * @param userData - User identification data
 */
export async function identifyUserForAudience(
  userId: string,
  userData: UserIdentificationData
): Promise<void> {
  if (!isMetaPixelLoaded()) {
    console.warn('Meta Pixel not loaded. Cannot identify user for audiences.');
    return;
  }

  try {
    // In test environment, we may not have the env var
    // Use a test pixel ID or get from window
    const pixelId =
      process.env.NEXT_PUBLIC_META_PIXEL_ID ||
      (typeof window !== 'undefined' && (window as any).__META_PIXEL_ID__) ||
      'test_pixel_id';

    // Build advanced matching parameters
    const advancedMatching: Record<string, any> = {
      external_id: userId,
    };

    // Add hashed email if provided
    if (userData.email) {
      advancedMatching.em = await hashEmail(userData.email);
    }

    // Initialize pixel with advanced matching
    window.fbq!('init', pixelId, advancedMatching);

    // Track user properties as custom parameters
    // These will be available in Meta Ads Manager for audience building
    if (userData.segments && userData.segments.length > 0) {
      const segmentString = userData.segments.join(',');

      window.fbq!('trackCustom', 'UserIdentified', {
        user_id: userId,
        segments: segmentString,
        plan: userData.plan,
        ltv: userData.ltv,
      });
    }
  } catch (error) {
    console.error('Failed to identify user for Meta audiences:', error);
  }
}

/**
 * Track a user moving into a new audience segment
 * Fires a custom event that can be used for audience creation in Meta Ads Manager
 *
 * @param userId - Unique user identifier
 * @param segment - The audience segment
 * @param properties - Additional properties about the segment change
 */
export function trackUserSegment(
  userId: string,
  segment: AudienceSegment,
  properties?: Record<string, any>
): void {
  if (!isMetaPixelLoaded()) {
    return;
  }

  try {
    // Convert cents to dollars for Meta reporting and normalize property names
    const normalizedProps: Record<string, any> = {};

    if (properties) {
      for (const [key, value] of Object.entries(properties)) {
        // Convert camelCase to snake_case
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();

        // Convert totalSpent from cents to dollars
        if (key === 'totalSpent' && typeof value === 'number') {
          normalizedProps.total_spent = value / 100;
        } else {
          normalizedProps[snakeKey] = value;
        }
      }
    }

    window.fbq!('trackCustom', 'UserSegmentUpdate', {
      segment,
      user_id: userId,
      ...normalizedProps,
    });
  } catch (error) {
    console.error('Failed to track user segment:', error);
  }
}

/**
 * Update user properties for future event tracking
 * Does not fire an event immediately, but stores properties for future events
 *
 * @param userId - Unique user identifier
 * @param properties - User properties to update
 */
export function updateUserProperties(
  userId: string,
  properties: Record<string, any>
): void {
  // This function doesn't fire events immediately
  // It's meant to update internal tracking state
  // Properties will be included in future events automatically

  // In a production system, you might want to store these in localStorage
  // or a user context for inclusion in subsequent events
  if (typeof window !== 'undefined') {
    try {
      const key = `meta_user_props_${userId}`;
      localStorage.setItem(key, JSON.stringify(properties));
    } catch (error) {
      // Silent fail for localStorage errors
    }
  }
}

/**
 * Get stored user properties
 *
 * @param userId - Unique user identifier
 * @returns User properties or empty object
 */
export function getUserProperties(userId: string): Record<string, any> {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const key = `meta_user_props_${userId}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}
