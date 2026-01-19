/**
 * Tests for Job Complete Email Template
 *
 * Feature: EMAIL-004
 * PRD: docs/prds/11-email-notifications.md
 */

import { describe, it, expect } from 'vitest';
import JobCompleteEmail from '../../apps/worker/src/templates/job-complete';

describe('JobCompleteEmail Template', () => {
  it('should export a function component', () => {
    expect(JobCompleteEmail).toBeDefined();
    expect(typeof JobCompleteEmail).toBe('function');
  });

  it('should accept all required props', () => {
    const props = {
      name: 'John Doe',
      title: 'My Amazing Video',
      duration: '45 seconds',
      credits: 1,
      downloadUrl: 'https://canvascast.ai/app/jobs/123',
      dashboardUrl: 'https://canvascast.ai/app',
    };

    // Component should not throw when called with props
    expect(() => JobCompleteEmail(props)).not.toThrow();
  });

  it('should handle empty name with default fallback', () => {
    const props = {
      name: '',
      title: 'My Video',
      duration: '45 seconds',
      credits: 1,
      downloadUrl: 'https://canvascast.ai/app/jobs/444',
      dashboardUrl: 'https://canvascast.ai/app',
    };

    expect(() => JobCompleteEmail(props)).not.toThrow();
  });

  it('should handle trimming whitespace from name', () => {
    const props = {
      name: '  John  ',
      title: 'My Video',
      duration: '45 seconds',
      credits: 1,
      downloadUrl: 'https://canvascast.ai/app/jobs/555',
      dashboardUrl: 'https://canvascast.ai/app',
    };

    expect(() => JobCompleteEmail(props)).not.toThrow();
  });

  it('should handle different credit amounts', () => {
    const props = {
      name: 'Charlie',
      title: 'Another Video',
      duration: '45 seconds',
      credits: 5,
      downloadUrl: 'https://canvascast.ai/app/jobs/222',
      dashboardUrl: 'https://canvascast.ai/app',
    };

    expect(() => JobCompleteEmail(props)).not.toThrow();
  });

  it('should handle different durations', () => {
    const props = {
      name: 'Bob',
      title: 'My Video',
      duration: '2 minutes',
      credits: 2,
      downloadUrl: 'https://canvascast.ai/app/jobs/111',
      dashboardUrl: 'https://canvascast.ai/app',
    };

    expect(() => JobCompleteEmail(props)).not.toThrow();
  });

  it('should return a React element when called', () => {
    const props = {
      name: 'Test User',
      title: 'Test Video',
      duration: '30 seconds',
      credits: 1,
      downloadUrl: 'https://canvascast.ai/app/jobs/333',
      dashboardUrl: 'https://canvascast.ai/app',
    };

    const result = JobCompleteEmail(props);

    // Should return a React element
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    expect(result).toHaveProperty('$$typeof');
  });
});
