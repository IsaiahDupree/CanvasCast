import { createLogger, LogLevel } from '../src/lib/logger';

describe('Logger Integration', () => {
  it('should demonstrate real-world usage', () => {
    // Create a service logger
    const apiLogger = createLogger({
      service: 'api',
      env: 'production',
      version: '1.0.0',
      level: LogLevel.INFO
    });

    // Simulate request handling
    const requestId = 'req-123';
    const requestLogger = apiLogger.child({ requestId });

    // These would normally log to console, but we're just checking they don't throw
    expect(() => {
      requestLogger.info('Request received', {
        method: 'POST',
        path: '/api/v1/projects',
        userId: 'user-456'
      });

      // Create child logger for specific component
      const controllerLogger = requestLogger.child({
        component: 'ProjectController'
      });

      controllerLogger.debug('Validating input');
      controllerLogger.info('Creating project', { projectId: 'proj-789' });

      // Simulate error
      const dbLogger = requestLogger.child({ component: 'Database' });
      const error = new Error('Connection timeout');
      dbLogger.error('Database query failed', { error, query: 'INSERT INTO projects' });

      requestLogger.info('Request completed', { statusCode: 500, duration: 150 });
    }).not.toThrow();
  });

  it('should support multiple independent logger instances', () => {
    const workerLogger = createLogger({
      service: 'worker',
      env: 'staging',
      level: LogLevel.DEBUG
    });

    const webLogger = createLogger({
      service: 'web',
      env: 'staging',
      level: LogLevel.WARN
    });

    expect(() => {
      workerLogger.debug('Processing job');
      webLogger.warn('Slow render detected');
    }).not.toThrow();
  });

  it('should handle nested context correctly', () => {
    const root = createLogger({ service: 'test' });
    const l1 = root.child({ layer: 'l1' });
    const l2 = l1.child({ layer: 'l2' });
    const l3 = l2.child({ layer: 'l3' });

    expect(() => {
      l3.info('Deep logging works');
    }).not.toThrow();
  });
});
