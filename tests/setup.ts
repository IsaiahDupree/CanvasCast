import { beforeAll, afterAll, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// Mock environment variables for tests
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54341";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-openai-key";
process.env.HF_TOKEN = process.env.HF_TOKEN || "test-hf-token";

// Global test setup
beforeAll(() => {
  // Silence console during tests unless DEBUG is set
  if (!process.env.DEBUG) {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  }
});

afterAll(() => {
  vi.restoreAllMocks();
});

// Test user credentials
export const TEST_USER = {
  email: "isaiahdupree33@gmail.com",
  password: "Frogger12",
};

// Test timeout for async operations
export const TEST_TIMEOUT = 30000;
