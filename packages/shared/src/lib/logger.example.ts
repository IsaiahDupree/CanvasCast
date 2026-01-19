/**
 * Logger Usage Examples
 *
 * This file demonstrates how to use the structured logger across CanvasCast services.
 */

import { createLogger, LogLevel } from './logger';

// ===== Example 1: Basic Logger Setup =====

// Create a logger for your service
const apiLogger = createLogger({
  service: 'api',
  env: process.env.NODE_ENV || 'development',
  level: process.env.LOG_LEVEL === 'debug' ? LogLevel.DEBUG : LogLevel.INFO
});

// Log some messages
apiLogger.info('Server started', { port: 8989 });
apiLogger.warn('High memory usage detected', { usage: '85%' });
apiLogger.error('Failed to connect to database', { host: 'localhost' });

// ===== Example 2: Request Logging with Trace IDs =====

// Create a request-scoped logger with trace ID
function handleRequest(req: any) {
  const requestLogger = apiLogger.child({
    traceId: req.headers['x-trace-id'] || crypto.randomUUID(),
    requestId: req.id,
    method: req.method,
    path: req.path
  });

  requestLogger.info('Request received');

  // Pass to other functions
  processRequest(requestLogger, req);

  requestLogger.info('Request completed', { duration: 150 });
}

function processRequest(logger: any, req: any) {
  logger.debug('Processing request', { userId: req.user?.id });
}

// ===== Example 3: Component-Scoped Logging =====

class ProjectController {
  private logger;

  constructor(parentLogger: any) {
    // Create component-specific logger
    this.logger = parentLogger.child({
      component: 'ProjectController'
    });
  }

  async createProject(data: any) {
    this.logger.info('Creating project', { title: data.title });

    try {
      // ... project creation logic
      this.logger.info('Project created successfully', { projectId: 'proj-123' });
    } catch (error) {
      this.logger.error('Failed to create project', { error });
      throw error;
    }
  }
}

// ===== Example 4: Error Logging =====

try {
  // Some operation
  throw new Error('Something went wrong');
} catch (error) {
  // Log error with full stack trace
  apiLogger.error('Operation failed', { error });

  // Or pass error as context
  apiLogger.error('Operation failed', error as Error);
}

// ===== Example 5: Worker Pipeline Logging =====

const workerLogger = createLogger({
  service: 'worker',
  level: LogLevel.DEBUG
});

function runPipeline(jobId: string) {
  // Create job-scoped logger
  const jobLogger = workerLogger.child({
    jobId,
    traceId: `job-${jobId}`
  });

  jobLogger.info('Pipeline started');

  // Step 1
  const step1Logger = jobLogger.child({ step: 'generate-script' });
  step1Logger.info('Generating script');
  step1Logger.info('Script generated', { length: 500 });

  // Step 2
  const step2Logger = jobLogger.child({ step: 'generate-voice' });
  step2Logger.info('Generating voice');
  step2Logger.info('Voice generated', { duration: 60 });

  jobLogger.info('Pipeline completed');
}

// ===== Example 6: Different Log Levels =====

const debugLogger = createLogger({
  service: 'debug-service',
  level: LogLevel.DEBUG  // Shows all logs
});

debugLogger.debug('Verbose debugging information');
debugLogger.info('Normal operational message');
debugLogger.warn('Warning about potential issue');
debugLogger.error('Error that needs attention');

// ===== Example 7: Production vs Development =====

const productionLogger = createLogger({
  service: 'api',
  env: 'production',
  level: LogLevel.INFO,  // Only INFO, WARN, ERROR
  version: '1.0.0'
});

const developmentLogger = createLogger({
  service: 'api',
  env: 'development',
  level: LogLevel.DEBUG,  // All logs including DEBUG
  version: '1.0.0'
});

// ===== Example 8: Custom Context Fields =====

const enrichedLogger = createLogger({
  service: 'api',
  datacenter: 'us-east-1',
  instance: 'i-1234567890',
  version: '2.1.0',
  deployment: 'blue-green'
});

enrichedLogger.info('Custom context example', {
  feature: 'video-generation',
  customer: 'enterprise-123'
});

// Output will include all context fields:
// {
//   "timestamp": "2024-01-19T...",
//   "level": "info",
//   "message": "Custom context example",
//   "service": "api",
//   "traceId": "...",
//   "datacenter": "us-east-1",
//   "instance": "i-1234567890",
//   "version": "2.1.0",
//   "deployment": "blue-green",
//   "feature": "video-generation",
//   "customer": "enterprise-123"
// }
