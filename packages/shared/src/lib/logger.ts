import { randomUUID } from 'crypto';

/**
 * Log levels in order of severity (lowest to highest)
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Context fields that can be added to log entries
 */
export interface LogContext {
  [key: string]: any;
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  /** Service name (required) */
  service: string;
  /** Log level threshold */
  level?: LogLevel;
  /** Trace ID for request tracking */
  traceId?: string;
  /** Additional context fields */
  [key: string]: any;
}

/**
 * Log entry structure
 */
interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  service: string;
  traceId: string;
  [key: string]: any;
}

/**
 * Logger interface
 */
export interface Logger {
  debug(message: string, context?: LogContext | Error): void;
  info(message: string, context?: LogContext | Error): void;
  warn(message: string, context?: LogContext | Error): void;
  error(message: string, context?: LogContext | Error): void;
  child(context: LogContext): Logger;
}

/**
 * Serialize an Error object to a JSON-friendly format
 */
function serializeError(error: Error): object {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...(error as any), // Include any additional properties
  };
}

/**
 * Check if a value is an Error instance
 */
function isError(value: any): value is Error {
  return value instanceof Error;
}

/**
 * Create a structured logger instance
 */
export function createLogger(config: LoggerConfig): Logger {
  const {
    service,
    level = LogLevel.INFO,
    traceId = randomUUID(),
    ...baseContext
  } = config;

  /**
   * Internal log function
   */
  function log(
    logLevel: LogLevel,
    levelName: string,
    message: string,
    context?: LogContext | Error
  ): void {
    // Check if log level is enabled
    if (logLevel < level) {
      return;
    }

    // Build log entry
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: levelName,
      message,
      service,
      traceId,
      ...baseContext,
    };

    // Handle Error or context object
    if (context) {
      if (isError(context)) {
        entry.error = serializeError(context);
      } else {
        // Merge context, handling errors within context
        Object.keys(context).forEach((key) => {
          const value = context[key];
          if (isError(value)) {
            entry[key] = serializeError(value);
          } else {
            entry[key] = value;
          }
        });
      }
    }

    // Output JSON
    const output = JSON.stringify(entry);

    // Use appropriate console method
    switch (logLevel) {
      case LogLevel.DEBUG:
        console.debug(output);
        break;
      case LogLevel.INFO:
        console.info(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      case LogLevel.ERROR:
        console.error(output);
        break;
      default:
        console.log(output);
    }
  }

  return {
    debug(message: string, context?: LogContext | Error): void {
      log(LogLevel.DEBUG, 'debug', message, context);
    },

    info(message: string, context?: LogContext | Error): void {
      log(LogLevel.INFO, 'info', message, context);
    },

    warn(message: string, context?: LogContext | Error): void {
      log(LogLevel.WARN, 'warn', message, context);
    },

    error(message: string, context?: LogContext | Error): void {
      log(LogLevel.ERROR, 'error', message, context);
    },

    child(childContext: LogContext): Logger {
      return createLogger({
        service,
        level,
        traceId,
        ...baseContext,
        ...childContext,
      });
    },
  };
}
