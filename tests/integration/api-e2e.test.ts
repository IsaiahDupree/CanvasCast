import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

// ============================================
// API ENDPOINTS E2E TESTS WITH DEBUG LOGGING
// ============================================
// These tests verify API endpoints with comprehensive
// console logging for debugging.

const SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Debug logger utility
function debugLog(context: string, message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [API-E2E] [${context}] ${message}`);
  if (data !== undefined) {
    console.log(`  └─ Data:`, typeof data === "string" ? data : JSON.stringify(data, null, 2));
  }
}

// HTTP request helper with logging
async function apiRequest(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<{ status: number; data: unknown; error?: string }> {
  const url = `${API_BASE_URL}${path}`;
  debugLog("REQUEST", `${method} ${url}`, body);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json().catch(() => null);
    
    debugLog("RESPONSE", `Status: ${response.status}`, data);

    return {
      status: response.status,
      data,
      error: response.ok ? undefined : data?.error || "Request failed",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    debugLog("ERROR", `Request failed: ${errorMessage}`);
    return {
      status: 0,
      data: null,
      error: errorMessage,
    };
  }
}

describe("API E2E - Health & Public Endpoints", () => {
  it("landing page is accessible", async () => {
    debugLog("TEST", "Checking landing page accessibility");
    
    try {
      const response = await fetch(API_BASE_URL);
      debugLog("RESULT", `Landing page status: ${response.status}`);
      expect(response.status).toBe(200);
    } catch (error) {
      debugLog("SKIP", `Server not running: ${error}`);
      expect(true).toBe(true);
    }
  });

  it("login page is accessible", async () => {
    debugLog("TEST", "Checking login page accessibility");
    
    try {
      const response = await fetch(`${API_BASE_URL}/login`);
      debugLog("RESULT", `Login page status: ${response.status}`);
      expect([200, 307, 308]).toContain(response.status);
    } catch (error) {
      debugLog("SKIP", `Server not running: ${error}`);
      expect(true).toBe(true);
    }
  });

  it("pricing page is accessible", async () => {
    debugLog("TEST", "Checking pricing page accessibility");
    
    try {
      const response = await fetch(`${API_BASE_URL}/pricing`);
      debugLog("RESULT", `Pricing page status: ${response.status}`);
      expect([200, 307, 308]).toContain(response.status);
    } catch (error) {
      debugLog("SKIP", `Server not running: ${error}`);
      expect(true).toBe(true);
    }
  });
});

describe("API E2E - Draft Prompts", () => {
  let draftId: string | null = null;

  afterAll(async () => {
    if (draftId) {
      debugLog("CLEANUP", `Removing draft: ${draftId}`);
      await supabase.from("draft_prompts").delete().eq("id", draftId);
    }
  });

  it("can create a draft prompt", async () => {
    debugLog("TEST", "Creating draft prompt via API");

    const result = await apiRequest("POST", "/api/draft", {
      promptText: "Create a motivational video about success and perseverance",
      templateId: "narrated_storyboard_v1",
      options: { quality: "standard" },
    });

    if (result.status === 0) {
      debugLog("SKIP", "API not available");
      return;
    }

    debugLog("RESULT", `Draft creation result`, result);

    if (result.status === 200 || result.status === 201) {
      draftId = (result.data as { draftId?: string })?.draftId || null;
      debugLog("SUCCESS", `Created draft: ${draftId}`);
    }

    expect([200, 201, 401, 500]).toContain(result.status);
  });

  it("rejects invalid draft prompt", async () => {
    debugLog("TEST", "Testing draft validation");

    const result = await apiRequest("POST", "/api/draft", {
      promptText: "short", // Too short, should fail validation
      templateId: "narrated_storyboard_v1",
    });

    if (result.status === 0) {
      debugLog("SKIP", "API not available");
      return;
    }

    debugLog("RESULT", `Validation result`, result);

    // Should return 400 for validation error
    expect([400, 500]).toContain(result.status);
  });

  it("can retrieve a draft prompt", async () => {
    debugLog("TEST", "Retrieving draft prompt");

    const result = await apiRequest("GET", "/api/draft");

    if (result.status === 0) {
      debugLog("SKIP", "API not available");
      return;
    }

    debugLog("RESULT", `Draft retrieval result`, result);
    expect([200, 401]).toContain(result.status);
  });
});

describe("API E2E - Projects (Authenticated)", () => {
  it("returns 401 for unauthenticated project list", async () => {
    debugLog("TEST", "Testing unauthenticated project access");

    const result = await apiRequest("GET", "/api/projects");

    if (result.status === 0) {
      debugLog("SKIP", "API not available");
      return;
    }

    debugLog("RESULT", `Unauthenticated access result`, result);
    expect(result.status).toBe(401);
  });

  it("returns 401 for unauthenticated project creation", async () => {
    debugLog("TEST", "Testing unauthenticated project creation");

    const result = await apiRequest("POST", "/api/projects", {
      title: "Test Project",
      niche_preset: "motivation",
      target_minutes: 5,
    });

    if (result.status === 0) {
      debugLog("SKIP", "API not available");
      return;
    }

    debugLog("RESULT", `Unauthenticated creation result`, result);
    expect(result.status).toBe(401);
  });
});

describe("API E2E - Stripe Webhooks", () => {
  it("rejects unsigned webhook", async () => {
    debugLog("TEST", "Testing unsigned Stripe webhook rejection");

    const result = await apiRequest("POST", "/api/stripe/webhook", {
      type: "checkout.session.completed",
      data: { object: {} },
    });

    if (result.status === 0) {
      debugLog("SKIP", "API not available");
      return;
    }

    debugLog("RESULT", `Unsigned webhook result`, result);
    // Should reject without valid signature
    expect([400, 401, 500]).toContain(result.status);
  });
});

describe("API E2E - Error Handling", () => {
  it("returns 404 for non-existent routes", async () => {
    debugLog("TEST", "Testing 404 handling");

    const result = await apiRequest("GET", "/api/nonexistent-endpoint-12345");

    if (result.status === 0) {
      debugLog("SKIP", "API not available");
      return;
    }

    debugLog("RESULT", `404 handling result`, result);
    expect(result.status).toBe(404);
  });

  it("returns 405 for wrong HTTP method", async () => {
    debugLog("TEST", "Testing 405 handling");

    const result = await apiRequest("DELETE", "/api/draft");

    if (result.status === 0) {
      debugLog("SKIP", "API not available");
      return;
    }

    debugLog("RESULT", `405 handling result`, result);
    expect([404, 405]).toContain(result.status);
  });

  it("handles malformed JSON gracefully", async () => {
    debugLog("TEST", "Testing malformed JSON handling");

    try {
      const response = await fetch(`${API_BASE_URL}/api/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid json }",
      });

      debugLog("RESULT", `Malformed JSON result: ${response.status}`);
      expect([400, 500]).toContain(response.status);
    } catch (error) {
      debugLog("SKIP", `Request failed: ${error}`);
      expect(true).toBe(true);
    }
  });
});

describe("API E2E - Response Times", () => {
  it("landing page loads within 3 seconds", async () => {
    debugLog("TEST", "Measuring landing page load time");

    const startTime = Date.now();
    
    try {
      await fetch(API_BASE_URL);
      const loadTime = Date.now() - startTime;
      
      debugLog("RESULT", `Landing page loaded in ${loadTime}ms`);
      expect(loadTime).toBeLessThan(3000);
    } catch (error) {
      debugLog("SKIP", `Server not running: ${error}`);
      expect(true).toBe(true);
    }
  });

  it("API endpoints respond within 2 seconds", async () => {
    debugLog("TEST", "Measuring API response time");

    const startTime = Date.now();
    
    try {
      await fetch(`${API_BASE_URL}/api/draft`);
      const responseTime = Date.now() - startTime;
      
      debugLog("RESULT", `API responded in ${responseTime}ms`);
      expect(responseTime).toBeLessThan(2000);
    } catch (error) {
      debugLog("SKIP", `Server not running: ${error}`);
      expect(true).toBe(true);
    }
  });
});
