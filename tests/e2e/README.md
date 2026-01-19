# CanvasCast E2E Tests

This directory contains end-to-end (E2E) tests for CanvasCast using Playwright.

## Setup

Playwright is configured to run E2E tests against the Next.js web application.

### Prerequisites

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Install Playwright browsers:
   ```bash
   pnpm playwright install chromium
   ```

3. Start local Supabase instance:
   ```bash
   supabase start
   ```

4. Create `.env.local` file in `apps/web/` with Supabase credentials:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54341
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase status>
   SUPABASE_SERVICE_ROLE_KEY=<from supabase status>
   PORT=3838
   APP_BASE_URL=http://localhost:3838
   ```

## Running Tests

### Run all E2E tests
```bash
pnpm test:e2e
```

### Run with UI mode
```bash
pnpm test:e2e:ui
```

### Run specific test file
```bash
pnpm playwright test public-pages.spec.ts
```

### Run specific test by name
```bash
pnpm playwright test --grep "Landing Page"
```

## Configuration

The Playwright configuration is in `playwright.config.ts` at the project root.

Key settings:
- **Test directory**: `./tests/e2e`
- **Base URL**: `http://localhost:3838` (configurable via `BASE_URL` env var)
- **Browser**: Chromium (Desktop Chrome)
- **Retries**: 0 locally, 2 in CI
- **Workers**: Unlimited locally, 1 in CI
- **Auto web server**: The config automatically starts the Next.js dev server before tests

## Test Categories

- **public-pages.spec.ts**: Tests for public pages (landing, login, signup, pricing)
- **auth.spec.ts**: Authentication flow tests
- **dashboard.spec.ts**: Dashboard and authenticated page tests
- **project-flow.spec.ts**: Video project creation and management
- **credits.spec.ts**: Credit purchase and management
- **accessibility.spec.ts**: Accessibility compliance tests
- **performance.spec.ts**: Performance and load time tests
- **playwright-setup.spec.ts**: Validation tests for Playwright configuration

## CI Integration

GitHub Actions workflow is configured in `.github/workflows/playwright.yml`.

The CI pipeline:
1. Installs dependencies
2. Installs Playwright browsers
3. Starts local Supabase
4. Runs E2E tests
5. Uploads test reports and screenshots

## Writing New Tests

Follow the existing test patterns:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Feature Name", () => {
  test("should do something", async ({ page }) => {
    await page.goto("/");

    const element = page.locator("selector");
    await expect(element).toBeVisible();
  });
});
```

## Troubleshooting

### Web server fails to start
- Check that Supabase is running: `supabase status`
- Verify `.env.local` file exists in `apps/web/`
- Check that port 3838 is not in use

### Tests timeout
- Increase timeout in `playwright.config.ts` or use `--timeout` flag
- Check network connection (tests may fail on slow connections)

### Browser not found
- Run `pnpm playwright install chromium` to install browsers

## Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Tests](https://playwright.dev/docs/debug)
