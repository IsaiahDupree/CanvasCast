/**
 * Job Failed Email Template Tests
 *
 * EMAIL-005: Job Failed Email Template
 * Tests that the job-failed email template is properly defined and exportable
 */

import { describe, it, expect } from 'vitest';
import JobFailedEmail from '../../apps/worker/src/templates/job-failed';

describe('JobFailedEmail Template', () => {
  it('should export a function component', () => {
    expect(JobFailedEmail).toBeDefined();
    expect(typeof JobFailedEmail).toBe('function');
  });

  it('should accept required props', () => {
    const props = {
      name: 'John Doe',
      title: 'My Amazing Video',
      errorMessage: 'Failed to generate images due to API rate limit',
      creditsRefunded: 1,
      supportUrl: 'https://canvascast.ai/support',
      dashboardUrl: 'https://canvascast.ai/app',
    };

    // Component should not throw when called with props
    expect(() => JobFailedEmail(props)).not.toThrow();
  });

  it('should handle empty name with default fallback', () => {
    const props = {
      name: '',
      title: 'My Video',
      errorMessage: 'An error occurred',
      creditsRefunded: 1,
      supportUrl: 'https://canvascast.ai/support',
      dashboardUrl: 'https://canvascast.ai/app',
    };

    expect(() => JobFailedEmail(props)).not.toThrow();
  });

  it('should handle different error messages', () => {
    const props = {
      name: 'Jane Smith',
      title: 'Test Video',
      errorMessage: 'Script generation failed',
      creditsRefunded: 2,
      supportUrl: 'https://canvascast.ai/support',
      dashboardUrl: 'https://canvascast.ai/app',
    };

    expect(() => JobFailedEmail(props)).not.toThrow();
  });

  it('should handle different credit refund amounts', () => {
    const props = {
      name: 'Test User',
      title: 'Video Project',
      errorMessage: 'Rendering timeout',
      creditsRefunded: 3,
      supportUrl: 'https://canvascast.ai/support',
      dashboardUrl: 'https://canvascast.ai/app',
    };

    expect(() => JobFailedEmail(props)).not.toThrow();
  });

  it('should return a React element when called', () => {
    const props = {
      name: 'Test User',
      title: 'My Video',
      errorMessage: 'Unknown error',
      creditsRefunded: 1,
      supportUrl: 'https://canvascast.ai/support',
      dashboardUrl: 'https://canvascast.ai/app',
    };

    const result = JobFailedEmail(props);

    // Should return a React element
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    expect(result).toHaveProperty('$$typeof');
  });
});
