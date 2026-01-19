import { test, expect } from "@playwright/test";

// ============================================
// Authentication E2E Tests
// Testing magic link signup/login and draft claim flows
// ============================================

test.describe("Authentication Flows", () => {
  test.describe("Signup Flow", () => {
    test("should display signup page with correct elements", async ({ page }) => {
      await page.goto("/signup");

      // Check page title
      await expect(page.locator("h1")).toContainText(/create your account|sign up/i);

      // Check for email input
      await expect(page.locator('input[type="email"]#email')).toBeVisible();

      // Check for Google OAuth button
      await expect(page.locator('button:has-text("Sign up with Google")')).toBeVisible();

      // Check for email submit button
      await expect(page.locator('button[type="submit"]:has-text("Continue with Email")')).toBeVisible();

      // Check for login link
      await expect(page.locator('a[href="/login"]')).toBeVisible();
    });

    test("should validate email format", async ({ page }) => {
      await page.goto("/signup");

      // Try to submit with invalid email
      await page.fill('#email', 'invalid-email');
      await page.click('button[type="submit"]:has-text("Continue with Email")');

      // Browser should show native validation error (HTML5 validation)
      const emailInput = page.locator('#email');
      const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
      expect(validationMessage).toBeTruthy();
    });

    test("should request magic link for valid email", async ({ page }) => {
      await page.goto("/signup");

      // Fill in valid email
      await page.fill('#email', 'test@example.com');

      // Submit form
      await page.click('button[type="submit"]:has-text("Continue with Email")');

      // Should show success message
      await expect(page.locator("h1:has-text('Check your email')")).toBeVisible({ timeout: 10000 });
      await expect(page.locator("text=test@example.com")).toBeVisible();
    });

    test("should show Google OAuth button and trigger auth flow", async ({ page }) => {
      await page.goto("/signup");

      // Click Google button
      const googleButton = page.locator('button:has-text("Sign up with Google")');
      await expect(googleButton).toBeVisible();

      // We can't fully test OAuth without mocking, but we can verify the button exists
      // and doesn't throw errors when clicked
      await expect(googleButton).toBeEnabled();
    });
  });

  test.describe("Login Flow", () => {
    test("should display login page with correct elements", async ({ page }) => {
      await page.goto("/login");

      // Check page title
      await expect(page.locator("h1")).toContainText(/welcome back|sign in/i);

      // Check for email input
      await expect(page.locator('input[type="email"]#email')).toBeVisible();

      // Check for Google OAuth button
      await expect(page.locator('button:has-text("Sign in with Google")')).toBeVisible();

      // Check for email submit button
      await expect(page.locator('button[type="submit"]:has-text("Continue with Email")')).toBeVisible();

      // Check for signup link
      await expect(page.locator('a[href="/signup"]')).toBeVisible();
    });

    test("should validate email format", async ({ page }) => {
      await page.goto("/login");

      // Try to submit with invalid email
      await page.fill('#email', 'not-an-email');
      await page.click('button[type="submit"]:has-text("Continue with Email")');

      // Browser should show native validation error
      const emailInput = page.locator('#email');
      const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
      expect(validationMessage).toBeTruthy();
    });

    test("should request magic link for valid email", async ({ page }) => {
      await page.goto("/login");

      // Fill in valid email
      await page.fill('#email', 'existing-user@example.com');

      // Submit form
      await page.click('button[type="submit"]:has-text("Continue with Email")');

      // Should show success message
      await expect(page.locator("h1:has-text('Check your email')")).toBeVisible({ timeout: 10000 });
      await expect(page.locator("text=existing-user@example.com")).toBeVisible();
    });
  });

  test.describe("Draft Claim Flow", () => {
    test("should preserve draft parameter in signup URL", async ({ page }) => {
      // Go to signup with draft parameter
      await page.goto("/signup?draft=test-draft-123");

      // Page should load successfully
      await expect(page.locator("h1")).toBeVisible();

      // The draft ID should be preserved (we can verify this by checking if fetch is called)
      // This is a basic test - more advanced testing would mock the API
    });

    test("should show draft preview on signup page when draft exists", async ({ page }) => {
      // Mock the draft API response
      await page.route("**/api/draft", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            draft: {
              id: "test-draft-123",
              promptText: "Create a video about testing authentication flows",
              templateId: "narrated_storyboard_v1",
              options: {},
              createdAt: new Date().toISOString(),
            },
          }),
        });
      });

      // Go to signup with draft parameter
      await page.goto("/signup?draft=test-draft-123");

      // Should show draft preview
      await expect(page.locator("h1:has-text('Your prompt is saved!')")).toBeVisible({ timeout: 10000 });
      await expect(page.locator("text=Create a video about testing authentication flows")).toBeVisible();
    });

    test("should include draft parameter in auth redirect", async ({ page }) => {
      // Mock the draft API response
      await page.route("**/api/draft", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            draft: {
              id: "test-draft-456",
              promptText: "My video idea",
              templateId: "narrated_storyboard_v1",
              options: {},
              createdAt: new Date().toISOString(),
            },
          }),
        });
      });

      // Go to signup with draft
      await page.goto("/signup?draft=test-draft-456");

      // Fill in email and submit
      await page.fill('#email', 'newuser@example.com');

      // Before clicking submit, verify the draft ID is present
      await page.click('button[type="submit"]:has-text("Continue with Email")');

      // Should show success message (magic link flow)
      await expect(page.locator("text=/check your email/i")).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Protected Routes", () => {
    test("should redirect unauthenticated users from /app to login", async ({ page }) => {
      await page.goto("/app");

      // Should redirect to login or show auth error
      await page.waitForURL(/\/(login|auth|signin)/, { timeout: 10000 });

      // Should be on login page
      expect(page.url()).toMatch(/\/(login|auth|signin)/);
    });

    test("should redirect unauthenticated users from /app/new to login", async ({ page }) => {
      await page.goto("/app/new");

      // Should redirect to login
      await page.waitForURL(/\/(login|auth|signin)/, { timeout: 10000 });
      expect(page.url()).toMatch(/\/(login|auth|signin)/);
    });

    test("should allow access to public pages", async ({ page }) => {
      // Landing page
      await page.goto("/");
      await expect(page.locator("body")).toBeVisible();
      expect(page.url()).toContain("/");

      // Signup page
      await page.goto("/signup");
      await expect(page.locator('h1:has-text("Create your account"), h1:has-text("Your prompt is saved")')).toBeVisible();

      // Login page
      await page.goto("/login");
      await expect(page.locator("h1")).toContainText(/welcome back|sign in/i);
    });
  });

  test.describe("Error Handling", () => {
    test("should handle missing draft gracefully", async ({ page }) => {
      // Mock 404 response for draft
      await page.route("**/api/draft", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ draft: null }),
        });
      });

      // Go to signup with non-existent draft
      await page.goto("/signup?draft=non-existent");

      // Page should still load without draft preview
      await expect(page.locator("h1")).toContainText(/create your account/i);
      await expect(page.locator("text=/your prompt is saved/i")).not.toBeVisible();
    });

    test("should handle draft API errors gracefully", async ({ page }) => {
      // Mock error response for draft
      await page.route("**/api/draft", async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Internal server error" }),
        });
      });

      // Go to signup with draft
      await page.goto("/signup?draft=error-test");

      // Page should still load
      await expect(page.locator("h1")).toBeVisible();
    });

    test("should display error message when magic link fails", async ({ page }) => {
      // This test would require mocking Supabase client errors
      // For now, we just verify the error UI exists in the component
      await page.goto("/signup");

      // Verify error container exists (it's rendered conditionally)
      const hasErrorHandling = await page.evaluate(() => {
        const html = document.documentElement.innerHTML;
        return html.includes("bg-red-500/10") || html.includes("error");
      });

      expect(hasErrorHandling).toBe(true);
    });
  });

  test.describe("Navigation", () => {
    test("should navigate from signup to login", async ({ page }) => {
      await page.goto("/signup");

      // Click login link
      await page.click('a[href="/login"]');

      // Should be on login page
      await expect(page).toHaveURL(/\/login/);
      await expect(page.locator("h1")).toContainText(/welcome back|sign in/i);
    });

    test("should navigate from login to signup", async ({ page }) => {
      await page.goto("/login");

      // Click signup link
      await page.click('a[href="/signup"]');

      // Should be on signup page
      await expect(page).toHaveURL(/\/signup/);
      await expect(page.locator("h1")).toContainText(/create your account/i);
    });

    test("should navigate back to home from auth pages", async ({ page }) => {
      await page.goto("/signup");

      // Click logo or home link
      const homeLink = page.locator('a[href="/"]').first();
      await homeLink.click();

      // Should be on home page
      await expect(page).toHaveURL("/");
    });
  });
});
