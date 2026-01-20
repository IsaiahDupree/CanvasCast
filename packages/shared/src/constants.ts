/**
 * Shared constants for CanvasCast
 */

/**
 * RESIL-002: Credit Refund Policy
 *
 * Refund threshold for automatic credit refunds.
 * Jobs that fail before this progress percentage will receive full credit refunds.
 * Jobs that fail after this threshold will NOT receive refunds (work has been done).
 *
 * Rationale:
 * - Progress < 30%: Minimal API costs (script gen only)
 * - Progress >= 30%: Significant costs incurred (TTS, Whisper, image gen)
 */
export const REFUND_THRESHOLD_PROGRESS = 30;

/**
 * Credit refund threshold mapped to job status.
 * Stages before ALIGNMENT are considered "low-cost" and eligible for refunds.
 */
export const REFUND_THRESHOLD_STAGE = "ALIGNMENT";

/**
 * RATE-003: Job Creation Rate Limits
 *
 * Rate limits for job creation per user, configurable by plan tier.
 * These limits prevent abuse and ensure fair resource allocation.
 */
export const JOB_CREATION_RATE_LIMITS = {
  /**
   * Free tier: 5 jobs per hour
   * For trial users and users without active subscriptions
   */
  free: {
    requests: 5,
    window: '1h' as const,
  },

  /**
   * Starter tier: 10 jobs per hour
   * For users with starter credit packs or basic subscriptions
   */
  starter: {
    requests: 10,
    window: '1h' as const,
  },

  /**
   * Pro tier: 30 jobs per hour
   * For users with pro credit packs or pro subscriptions
   */
  pro: {
    requests: 30,
    window: '1h' as const,
  },

  /**
   * Creator+ tier: 100 jobs per hour
   * For users with creator+ credit packs or enterprise subscriptions
   */
  creator_plus: {
    requests: 100,
    window: '1h' as const,
  },
} as const;

/**
 * Type for plan-based rate limit tiers
 */
export type RateLimitTier = keyof typeof JOB_CREATION_RATE_LIMITS;
