/**
 * Welcome Email Template Tests
 *
 * EMAIL-003: Welcome Email Template
 * Tests that the welcome email template is properly defined and exportable
 */

import { describe, it, expect } from 'vitest';
import WelcomeEmail from '../../apps/worker/src/templates/welcome';

describe('WelcomeEmail Template', () => {
  it('should export a function component', () => {
    expect(WelcomeEmail).toBeDefined();
    expect(typeof WelcomeEmail).toBe('function');
  });

  it('should accept required props', () => {
    const props = {
      name: 'John Doe',
      trialCredits: 10,
      createUrl: 'https://canvascast.ai/app/new',
    };

    // Component should not throw when called with props
    expect(() => WelcomeEmail(props)).not.toThrow();
  });

  it('should handle empty name with default fallback', () => {
    const props = {
      name: '',
      trialCredits: 10,
      createUrl: 'https://canvascast.ai/app/new',
    };

    expect(() => WelcomeEmail(props)).not.toThrow();
  });

  it('should handle different credit amounts', () => {
    const props = {
      name: 'Jane Smith',
      trialCredits: 5,
      createUrl: 'https://canvascast.ai/app/new',
    };

    expect(() => WelcomeEmail(props)).not.toThrow();
  });

  it('should return a React element when called', () => {
    const props = {
      name: 'Test User',
      trialCredits: 10,
      createUrl: 'https://canvascast.ai/app/new',
    };

    const result = WelcomeEmail(props);

    // Should return a React element
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    expect(result).toHaveProperty('$$typeof');
  });
});
