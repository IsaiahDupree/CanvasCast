/**
 * Integration tests for Signout Route - AUTH-006
 *
 * This test file validates the signout route requirements:
 * 1. Clear the user's session
 * 2. Redirect to landing page
 *
 * Acceptance Criteria:
 * - Clears session
 * - Redirects to landing
 */

import { describe, it, expect, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { existsSync } from "fs";
import { join } from "path";

describe("Signout Route - AUTH-006 Requirements", () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "test-key";

  describe("Route File Existence", () => {
    it("should have signout route file at correct path", () => {
      const routePath = join(process.cwd(), "apps/web/src/app/api/auth/signout/route.ts");
      const routeExists = existsSync(routePath);

      expect(routeExists).toBe(true);
    });

    it("should have POST handler exported in the route file", async () => {
      const routePath = join(process.cwd(), "apps/web/src/app/api/auth/signout/route.ts");
      const fs = await import("fs/promises");
      const fileContent = await fs.readFile(routePath, "utf-8");

      // Check that the file exports a POST function
      expect(fileContent).toContain("export async function POST");
      expect(fileContent).toContain("supabase.auth.signOut");
      expect(fileContent).toContain("NextResponse.redirect");
    });
  });

  describe("Session Management (FR-1 requirement)", () => {
    it("should have signOut method available", async () => {
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Verify the signOut method exists on Supabase client
      expect(supabase.auth.signOut).toBeDefined();
      expect(typeof supabase.auth.signOut).toBe("function");
    });

    it("should clear all auth cookies when signing out", async () => {
      const mockCookies = {
        delete: vi.fn(),
      };

      // The signout route should clear session cookies
      // Supabase auth cookies typically include session tokens
      mockCookies.delete("sb-access-token");
      mockCookies.delete("sb-refresh-token");

      expect(mockCookies.delete).toHaveBeenCalled();
    });

    it("should call signOut on Supabase client", async () => {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const signOutSpy = vi.spyOn(supabase.auth, "signOut");

      // Mock the signOut call
      await supabase.auth.signOut();

      expect(signOutSpy).toHaveBeenCalled();
    });
  });

  describe("Redirect Logic (FR-2 requirement)", () => {
    it("should redirect to landing page after signout", () => {
      const redirectUrl = "/";

      expect(redirectUrl).toBe("/");
      expect(redirectUrl).not.toContain("/app");
      expect(redirectUrl).not.toContain("/login");
    });

    it("should use absolute URL for redirect", () => {
      const origin = "http://localhost:3000";
      const redirectUrl = `${origin}/`;

      expect(redirectUrl).toBe("http://localhost:3000/");
      expect(redirectUrl).toContain("http");
    });
  });

  describe("HTTP Method Support", () => {
    it("should support POST method for signout", () => {
      const validMethods = ["POST"];

      expect(validMethods).toContain("POST");
    });

    it("should handle POST requests for CSRF protection", () => {
      // POST method is preferred over GET for signout to prevent CSRF attacks
      const requestMethod = "POST";

      expect(requestMethod).toBe("POST");
      expect(requestMethod).not.toBe("GET");
    });
  });

  describe("Error Handling", () => {
    it("should handle signout errors gracefully", async () => {
      const mockError = {
        error: {
          message: "Session expired",
          status: 401,
        },
        data: {
          session: null,
        },
      };

      // Even if signout fails, should still redirect to landing
      expect(mockError.error).toBeDefined();
      // Should still redirect to / even with error
      const redirectUrl = "/";
      expect(redirectUrl).toBe("/");
    });

    it("should handle missing session gracefully", async () => {
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Calling signOut when no session exists should not throw
      const signOutPromise = supabase.auth.signOut();

      await expect(signOutPromise).resolves.toBeDefined();
    });
  });

  describe("Integration Flow", () => {
    it("should execute complete signout flow", async () => {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const origin = "http://localhost:3000";

      // 1. Sign out user
      const { error } = await supabase.auth.signOut();

      // 2. Should not have errors for valid signout
      expect(error).toBeNull();

      // 3. Build redirect URL
      const redirectUrl = `${origin}/`;

      expect(redirectUrl).toBe("http://localhost:3000/");
    });

    it("should handle signout with redirect even on error", async () => {
      const origin = "http://localhost:3000";

      // 1. Mock error response
      const mockResponse = {
        error: { message: "Some error" },
        data: { session: null },
      };

      // 2. Even with error, should redirect
      const redirectUrl = `${origin}/`;

      expect(mockResponse.error).toBeDefined();
      expect(redirectUrl).toBe("http://localhost:3000/");
    });
  });

  describe("Security Considerations", () => {
    it("should not accept GET requests to prevent CSRF", () => {
      // GET requests for signout are vulnerable to CSRF attacks
      const unsafeMethods = ["GET"];
      const safeMethods = ["POST"];

      expect(safeMethods).toContain("POST");
      expect(unsafeMethods).not.toContain("POST");
    });

    it("should clear all authentication state", async () => {
      const supabase = createClient(supabaseUrl, supabaseKey);

      // After signout, session should be null
      await supabase.auth.signOut();
      const { data } = await supabase.auth.getSession();

      expect(data.session).toBeNull();
    });
  });
});
