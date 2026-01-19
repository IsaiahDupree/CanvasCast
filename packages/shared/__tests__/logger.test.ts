import { createLogger, Logger, LogLevel } from '../src/lib/logger';
import { vi } from 'vitest';

describe('Logger', () => {
  let originalConsole: typeof console;
  let logs: string[];

  beforeEach(() => {
    logs = [];
    originalConsole = global.console;

    // Mock console methods to capture output
    global.console = {
      ...originalConsole,
      log: vi.fn((...args: any[]) => logs.push(args.join(' '))),
      error: vi.fn((...args: any[]) => logs.push(args.join(' '))),
      warn: vi.fn((...args: any[]) => logs.push(args.join(' '))),
      info: vi.fn((...args: any[]) => logs.push(args.join(' '))),
      debug: vi.fn((...args: any[]) => logs.push(args.join(' '))),
    } as any;
  });

  afterEach(() => {
    global.console = originalConsole;
  });

  describe('createLogger', () => {
    it('should create a logger instance', () => {
      const logger = createLogger({ service: 'test' });
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should include service name in context', () => {
      const logger = createLogger({ service: 'test-service' });
      logger.info('test message');

      const logEntry = JSON.parse(logs[0]);
      expect(logEntry.service).toBe('test-service');
    });

    it('should respect log level', () => {
      const logger = createLogger({
        service: 'test',
        level: LogLevel.WARN
      });

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');

      expect(logs.length).toBe(1); // Only warn should be logged
      const logEntry = JSON.parse(logs[0]);
      expect(logEntry.level).toBe('warn');
    });
  });

  describe('Structured JSON logging', () => {
    it('should log in JSON format', () => {
      const logger = createLogger({ service: 'test' });
      logger.info('test message');

      expect(() => JSON.parse(logs[0])).not.toThrow();

      const logEntry = JSON.parse(logs[0]);
      expect(logEntry.message).toBe('test message');
    });

    it('should include timestamp', () => {
      const logger = createLogger({ service: 'test' });
      logger.info('test message');

      const logEntry = JSON.parse(logs[0]);
      expect(logEntry.timestamp).toBeDefined();
      expect(new Date(logEntry.timestamp).getTime()).toBeGreaterThan(0);
    });

    it('should include log level', () => {
      const logger = createLogger({ service: 'test', level: LogLevel.DEBUG });

      logger.info('info message');
      logger.error('error message');
      logger.warn('warn message');
      logger.debug('debug message');

      expect(JSON.parse(logs[0]).level).toBe('info');
      expect(JSON.parse(logs[1]).level).toBe('error');
      expect(JSON.parse(logs[2]).level).toBe('warn');
      expect(JSON.parse(logs[3]).level).toBe('debug');
    });

    it('should include additional context fields', () => {
      const logger = createLogger({ service: 'test', env: 'production' });
      logger.info('test message', { userId: '123', action: 'login' });

      const logEntry = JSON.parse(logs[0]);
      expect(logEntry.userId).toBe('123');
      expect(logEntry.action).toBe('login');
      expect(logEntry.env).toBe('production');
    });
  });

  describe('Trace ID support', () => {
    it('should generate and include trace ID', () => {
      const logger = createLogger({ service: 'test' });
      logger.info('test message');

      const logEntry = JSON.parse(logs[0]);
      expect(logEntry.traceId).toBeDefined();
      expect(typeof logEntry.traceId).toBe('string');
      expect(logEntry.traceId.length).toBeGreaterThan(0);
    });

    it('should allow setting custom trace ID', () => {
      const logger = createLogger({
        service: 'test',
        traceId: 'custom-trace-123'
      });
      logger.info('test message');

      const logEntry = JSON.parse(logs[0]);
      expect(logEntry.traceId).toBe('custom-trace-123');
    });

    it('should create child logger with same trace ID', () => {
      const parentLogger = createLogger({
        service: 'parent',
        traceId: 'trace-abc'
      });

      const childLogger = parentLogger.child({ component: 'child' });
      childLogger.info('child message');

      const logEntry = JSON.parse(logs[0]);
      expect(logEntry.traceId).toBe('trace-abc');
      expect(logEntry.component).toBe('child');
      expect(logEntry.service).toBe('parent');
    });
  });

  describe('Error logging', () => {
    it('should serialize error objects', () => {
      const logger = createLogger({ service: 'test' });
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:1:1';

      logger.error('Error occurred', { error });

      const logEntry = JSON.parse(logs[0]);
      expect(logEntry.error).toBeDefined();
      expect(logEntry.error.message).toBe('Test error');
      expect(logEntry.error.stack).toBeDefined();
      expect(logEntry.error.name).toBe('Error');
    });

    it('should handle error as second parameter', () => {
      const logger = createLogger({ service: 'test' });
      const error = new Error('Test error');

      logger.error('Error occurred', error);

      const logEntry = JSON.parse(logs[0]);
      expect(logEntry.error).toBeDefined();
      expect(logEntry.error.message).toBe('Test error');
    });
  });

  describe('Log levels', () => {
    it('should support all log levels', () => {
      const logger = createLogger({ service: 'test', level: LogLevel.DEBUG });

      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      expect(logs.length).toBe(4);
    });

    it('should filter logs below specified level', () => {
      const logger = createLogger({ service: 'test', level: LogLevel.ERROR });

      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      expect(logs.length).toBe(1); // Only error
      expect(JSON.parse(logs[0]).level).toBe('error');
    });

    it('should default to INFO level', () => {
      const logger = createLogger({ service: 'test' });

      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');

      expect(logs.length).toBe(2); // info and warn only
    });
  });

  describe('Child loggers', () => {
    it('should inherit parent context', () => {
      const parent = createLogger({
        service: 'api',
        env: 'prod',
        traceId: 'trace-123'
      });

      const child = parent.child({ endpoint: '/users' });
      child.info('Request received');

      const logEntry = JSON.parse(logs[0]);
      expect(logEntry.service).toBe('api');
      expect(logEntry.env).toBe('prod');
      expect(logEntry.traceId).toBe('trace-123');
      expect(logEntry.endpoint).toBe('/users');
    });

    it('should allow child to override parent fields', () => {
      const parent = createLogger({ service: 'api', version: '1.0' });
      const child = parent.child({ version: '2.0' });

      child.info('test');

      const logEntry = JSON.parse(logs[0]);
      expect(logEntry.version).toBe('2.0');
    });

    it('should support nested child loggers', () => {
      const l1 = createLogger({ service: 'api' });
      const l2 = l1.child({ layer: 'controller' });
      const l3 = l2.child({ function: 'createUser' });

      l3.info('Creating user');

      const logEntry = JSON.parse(logs[0]);
      expect(logEntry.service).toBe('api');
      expect(logEntry.layer).toBe('controller');
      expect(logEntry.function).toBe('createUser');
    });
  });
});
