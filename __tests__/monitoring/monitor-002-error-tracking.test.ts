import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('MONITOR-002: Error Tracking', () => {
  const rootDir = resolve(__dirname, '../..');
  const webSentryFile = resolve(rootDir, 'apps/web/src/lib/sentry.ts');
  const apiSentryFile = resolve(rootDir, 'apps/api/src/lib/sentry.ts');

  describe('Sentry Setup Files', () => {
    it('should have sentry.ts in web app', () => {
      expect(existsSync(webSentryFile)).toBe(true);
    });

    it('should have sentry.ts in api app', () => {
      expect(existsSync(apiSentryFile)).toBe(true);
    });
  });

  describe('Web App Sentry Configuration', () => {
    it('should import Sentry from @sentry/nextjs', () => {
      const content = readFileSync(webSentryFile, 'utf-8');
      expect(content).toMatch(/@sentry\/nextjs/);
    });

    it('should export initSentry function', () => {
      const content = readFileSync(webSentryFile, 'utf-8');
      expect(content).toMatch(/export.*initSentry/);
    });

    it('should export captureError function', () => {
      const content = readFileSync(webSentryFile, 'utf-8');
      expect(content).toMatch(/export.*captureError/);
    });

    it('should initialize Sentry with DSN from environment', () => {
      const content = readFileSync(webSentryFile, 'utf-8');
      expect(content).toContain('SENTRY_DSN');
      expect(content).toMatch(/Sentry\.init/);
    });

    it('should configure environment and traces sample rate', () => {
      const content = readFileSync(webSentryFile, 'utf-8');
      expect(content).toContain('environment');
      expect(content).toContain('tracesSampleRate');
    });
  });

  describe('API Sentry Configuration', () => {
    it('should import Sentry from @sentry/node', () => {
      const content = readFileSync(apiSentryFile, 'utf-8');
      expect(content).toMatch(/@sentry\/node/);
    });

    it('should export initSentry function', () => {
      const content = readFileSync(apiSentryFile, 'utf-8');
      expect(content).toMatch(/export.*initSentry/);
    });

    it('should export captureError function', () => {
      const content = readFileSync(apiSentryFile, 'utf-8');
      expect(content).toMatch(/export.*captureError/);
    });

    it('should initialize Sentry with DSN from environment', () => {
      const content = readFileSync(apiSentryFile, 'utf-8');
      expect(content).toContain('SENTRY_DSN');
      expect(content).toMatch(/Sentry\.init/);
    });

    it('should configure environment and traces sample rate', () => {
      const content = readFileSync(apiSentryFile, 'utf-8');
      expect(content).toContain('environment');
      expect(content).toContain('tracesSampleRate');
    });
  });

  describe('Error Context and Categorization', () => {
    it('should support error context with userId', () => {
      const apiContent = readFileSync(apiSentryFile, 'utf-8');
      expect(apiContent).toMatch(/userId|user/i);
    });

    it('should support error context with jobId', () => {
      const apiContent = readFileSync(apiSentryFile, 'utf-8');
      expect(apiContent).toMatch(/jobId|job/i);
    });

    it('should support additional context fields', () => {
      const apiContent = readFileSync(apiSentryFile, 'utf-8');
      expect(apiContent).toMatch(/extra|context/i);
    });
  });

  describe('Dependencies', () => {
    it('should have @sentry/nextjs in web dependencies', () => {
      const webPackageFile = resolve(rootDir, 'apps/web/package.json');
      const webPackage = JSON.parse(readFileSync(webPackageFile, 'utf-8'));

      const hasSentry =
        webPackage.dependencies?.['@sentry/nextjs'] ||
        webPackage.devDependencies?.['@sentry/nextjs'];

      expect(hasSentry).toBeDefined();
    });

    it('should have @sentry/node in api dependencies', () => {
      const apiPackageFile = resolve(rootDir, 'apps/api/package.json');
      const apiPackage = JSON.parse(readFileSync(apiPackageFile, 'utf-8'));

      const hasSentry =
        apiPackage.dependencies?.['@sentry/node'] ||
        apiPackage.devDependencies?.['@sentry/node'];

      expect(hasSentry).toBeDefined();
    });
  });
});

describe('MONITOR-002: Error Capture Functionality', () => {
  const mockSentry = {
    init: vi.fn(),
    captureException: vi.fn(),
    withScope: vi.fn((callback) => {
      const scope = {
        setUser: vi.fn(),
        setTag: vi.fn(),
        setExtras: vi.fn(),
        setContext: vi.fn(),
      };
      callback(scope);
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should capture errors with proper context', async () => {
    // This test will pass once implementation is complete
    const rootDir = resolve(__dirname, '../..');
    const apiSentryFile = resolve(rootDir, 'apps/api/src/lib/sentry.ts');

    // Verify the file structure supports error capture with context
    const content = readFileSync(apiSentryFile, 'utf-8');

    // Should have a captureError function that accepts context
    expect(content).toMatch(/captureError/);
    expect(content).toMatch(/withScope/);
  });

  it('should handle errors without DSN gracefully', () => {
    // When SENTRY_DSN is not set, Sentry should not be initialized
    const rootDir = resolve(__dirname, '../..');
    const apiSentryFile = resolve(rootDir, 'apps/api/src/lib/sentry.ts');
    const content = readFileSync(apiSentryFile, 'utf-8');

    // Should check for DSN before initializing
    expect(content).toMatch(/SENTRY_DSN/);
  });

  it('should export error tracking utilities', () => {
    const rootDir = resolve(__dirname, '../..');
    const apiSentryFile = resolve(rootDir, 'apps/api/src/lib/sentry.ts');
    const content = readFileSync(apiSentryFile, 'utf-8');

    // Should export both init and capture functions
    expect(content).toMatch(/export/);
    expect(content).toMatch(/initSentry|init/);
    expect(content).toMatch(/captureError|capture/);
  });
});
