/**
 * Sentry Error Tracking for API
 *
 * Integrates Sentry for error tracking and monitoring in the Express API.
 * Captures exceptions with context including user ID, job ID, and custom metadata.
 */

import * as Sentry from '@sentry/node';

/**
 * Context fields that can be added to error captures
 */
export interface ErrorContext {
  userId?: string;
  jobId?: string;
  projectId?: string;
  requestId?: string;
  extra?: Record<string, any>;
  tags?: Record<string, string>;
}

/**
 * Initialize Sentry error tracking
 *
 * Should be called once at application startup before any request handlers.
 * Only initializes if SENTRY_DSN is configured.
 *
 * @returns boolean indicating if Sentry was initialized
 */
export function initSentry(): boolean {
  const dsn = process.env.SENTRY_DSN;

  // Skip initialization if DSN is not configured
  if (!dsn) {
    console.info('[Sentry] DSN not configured, error tracking disabled');
    return false;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',

    // Adjust this value in production to control trace sampling
    // 0.1 = 10% of transactions will be traced
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Profiling samples - helps identify performance bottlenecks
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Filter out sensitive information
    beforeSend(event) {
      // Remove sensitive data from URLs and headers
      if (event.request?.url) {
        event.request.url = event.request.url.replace(/([?&]token=)[^&]*/, '$1[FILTERED]');
      }

      // Remove authorization headers
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }

      return event;
    },
  });

  console.info('[Sentry] Initialized successfully');
  return true;
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
 *   await processJob(jobId);
 * } catch (error) {
 *   captureError(error, {
 *     userId: job.userId,
 *     jobId: job.id,
 *     extra: { jobData: job }
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
    if (context?.requestId) {
      scope.setTag('requestId', context.requestId);
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

/**
 * Categorize errors for better alerting and organization
 *
 * @param error - The error to categorize
 * @returns Error category string
 */
export function categorizeError(error: Error): string {
  const errorCode = (error as any).code;
  const message = error.message.toLowerCase();

  // Auth errors
  if (errorCode?.startsWith('AUTH_') || message.includes('unauthorized') || message.includes('forbidden')) {
    return 'auth';
  }

  // Pipeline errors
  if (errorCode?.startsWith('PIPELINE_') || message.includes('pipeline')) {
    return 'pipeline';
  }

  // Payment errors
  if (errorCode?.startsWith('PAYMENT_') || message.includes('stripe') || message.includes('payment')) {
    return 'payment';
  }

  // Timeout errors
  if (message.includes('timeout') || message.includes('timed out')) {
    return 'timeout';
  }

  // Rate limit errors
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'rate_limit';
  }

  // Database errors
  if (message.includes('database') || message.includes('supabase') || message.includes('postgres')) {
    return 'database';
  }

  // External API errors
  if (message.includes('openai') || message.includes('gemini') || message.includes('api')) {
    return 'external_api';
  }

  return 'unknown';
}

/**
 * Express middleware to capture request context
 * Should be added before all request handlers
 *
 * @example
 * ```typescript
 * import { initSentry, setupExpressErrorHandler } from './lib/sentry';
 *
 * initSentry();
 * app.use(setupExpressErrorHandler());
 * ```
 */
export function setupExpressErrorHandler() {
  return (err: Error, req: any, res: any, next: any) => {
    // Capture error with request context
    captureError(err, {
      userId: req.user?.id,
      requestId: req.id || req.headers['x-request-id'],
      extra: {
        url: req.url,
        method: req.method,
        ip: req.ip,
      },
    });

    // Pass to next error handler
    next(err);
  };
}
