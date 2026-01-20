// Manual mock for posthog-js
export const mockCapture = jest.fn();
export const mockIdentify = jest.fn();
export const mockDebug = jest.fn();
export const mockReset = jest.fn();

export const mockPostHog = {
  capture: mockCapture,
  identify: mockIdentify,
  debug: mockDebug,
  reset: mockReset,
};

export const mockInit = jest.fn((apiKey, config) => {
  if (config && config.loaded) {
    // Simulate async initialization
    setTimeout(() => config.loaded(mockPostHog), 0);
  }
});

const posthog = {
  init: mockInit,
  capture: mockCapture,
  identify: mockIdentify,
  debug: mockDebug,
  reset: mockReset,
};

export default posthog;
