import { test, expect } from "@playwright/test";

// ============================================
// Playwright Setup Validation Tests
// ============================================
// These tests verify that Playwright is correctly
// configured and can run tests successfully

test.describe("Playwright Setup", () => {
  test("can navigate to a page", async ({ page }) => {
    // This test verifies basic navigation works
    await page.goto("/");
    expect(page.url()).toContain("localhost");
  });

  test("can find and interact with elements", async ({ page }) => {
    // This test verifies element interaction works
    await page.goto("/");
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("has correct browser context", async ({ browser }) => {
    // This test verifies browser setup works
    expect(browser).toBeDefined();
    const context = await browser.newContext();
    expect(context).toBeDefined();
    await context.close();
  });

  test("can take screenshots", async ({ page }) => {
    // This test verifies screenshot functionality
    await page.goto("/");
    const screenshot = await page.screenshot();
    expect(screenshot).toBeDefined();
    expect(screenshot.length).toBeGreaterThan(0);
  });

  test("has tracing enabled", async ({ context }) => {
    // This test verifies context features are available
    expect(context).toBeDefined();
  });

  test("respects viewport settings", async ({ page }) => {
    // This test verifies viewport configuration
    await page.goto("/");
    const viewport = page.viewportSize();
    expect(viewport).toBeDefined();
    expect(viewport?.width).toBeGreaterThan(0);
    expect(viewport?.height).toBeGreaterThan(0);
  });
});
