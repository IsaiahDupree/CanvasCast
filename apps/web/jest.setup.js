// Add custom jest matchers from jest-dom
import '@testing-library/jest-dom';

// Mock environment variables for tests
process.env.NEXT_PUBLIC_POSTHOG_KEY = 'test-posthog-key';
process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://app.posthog.com';
