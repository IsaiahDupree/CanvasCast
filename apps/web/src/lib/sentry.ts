/**
 * Sentry Error Tracking for Web App
 *
 * Integrates Sentry for error tracking and monitoring in the Next.js frontend.
 * Captures exceptions with context including user ID, job ID, and custom metadata.
 */

import * as Sentry from '@sentry/nextjs';

/**
 * Context fields that can be added to error captures
 */
export interface ErrorContext {
  userId?: string;
  jobId?: string;
  projectId?: string;
  extra?: Record<string, any>;
  tags?: Record<string, string>;
}

/**
 * Initialize Sentry error tracking
 *
 * Should be called once at application startup.
 * Only initializes if SENTRY_DSN is configured.
 */
export function initSentry(): void {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  // Skip initialization if DSN is not configured
  if (!dsn) {
    console.info('[Sentry] DSN not configured, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',

    // Adjust this value in production to control trace sampling
    // 0.1 = 10% of transactions will be traced
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Session replay sampling
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

    // Capture breadcrumbs
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Filter out sensitive information
    beforeSend(event) {
      // Remove sensitive data from URLs
      if (event.request?.url) {
        event.request.url = event.request.url.replace(/([?&]token=)[^&]*/, '$1[FILTERED]');
      }
      return event;
    },
  });

  console.info('[Sentry] Initialized successfully');
}

/**
 * Capture an error with optional context
 *
 * @param error - The error to capture
 * @param context - Additional context for the error
 *
 * @example
 * ```typescript
 * try {
 *   await createProject(data);
 * } catch (error) {
 *   captureError(error, {
 *     userId: session.user.id,
 *     extra: { projectData: data }
 *   });
 *   throw error;
 * }
 * ```
 */
export function captureError(error: Error, context?: ErrorContext): void {
  Sentry.withScope((scope) => {
    // Set user context
    if (context?.userId) {
      scope.setUser({ id: context.userId });
    }

    // Set tags for filtering
    if (context?.jobId) {
      scope.setTag('jobId', context.jobId);
    }
    if (context?.projectId) {
      scope.setTag('projectId', context.projectId);
    }
    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }

    // Set extra context data
    if (context?.extra) {
      scope.setExtras(context.extra);
    }

    // Capture the exception
    Sentry.captureException(error);
  });
}

/**
 * Capture a message (non-error) with optional context
 *
 * @param message - The message to capture
 * @param level - The severity level
 * @param context - Additional context
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: ErrorContext
): void {
  Sentry.withScope((scope) => {
    if (context?.userId) {
      scope.setUser({ id: context.userId });
    }
    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }
    if (context?.extra) {
      scope.setExtras(context.extra);
    }

    Sentry.captureMessage(message, level);
  });
}

/**
 * Set user context for subsequent error captures
 *
 * @param userId - The user ID to associate with errors
 * @param email - Optional user email
 */
export function setUser(userId: string | null, email?: string): void {
  if (userId) {
    Sentry.setUser({ id: userId, email });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Add a breadcrumb (event trail) for debugging
 *
 * @param message - Breadcrumb message
 * @param category - Breadcrumb category
 * @param data - Additional data
 */
export function addBreadcrumb(
  message: string,
  category: string = 'custom',
  data?: Record<string, any>
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    level: 'info',
    data,
  });
}
