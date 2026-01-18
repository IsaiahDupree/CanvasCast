# PRD: Testing Infrastructure

**Subsystem:** Testing  
**Version:** 1.0  
**Status:** Implemented  
**Owner:** Isaiah  

---

## 1. Overview

The Testing Infrastructure subsystem provides comprehensive test coverage across unit, integration, and end-to-end tests. It ensures code quality, catches regressions, and enables confident deployments.

### Business Goal
Ship features faster with fewer bugs by catching issues early in development.

---

## 2. User Stories

### US-1: Regression Prevention
**As a** developer  
**I want** automated tests  
**So that** I don't break existing features

### US-2: Confident Refactoring
**As a** developer  
**I want** comprehensive coverage  
**So that** I can refactor safely

### US-3: Fast Feedback
**As a** developer  
**I want** quick test runs  
**So that** I get immediate feedback

---

## 3. Test Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        TEST ARCHITECTURE                                 │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Test Pyramid                                │   │
│  │                                                                  │   │
│  │                         ┌────┐                                   │   │
│  │                        /      \                                  │   │
│  │                       /  E2E   \         (~10 tests)             │   │
│  │                      /──────────\                                │   │
│  │                     /            \                               │   │
│  │                    / Integration  \      (~50 tests)             │   │
│  │                   /────────────────\                             │   │
│  │                  /                  \                            │   │
│  │                 /    Unit Tests      \   (~200 tests)            │   │
│  │                /──────────────────────\                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │    Vitest   │  │  Playwright │  │   Jest      │  │  pgTAP      │   │
│  │   (Unit)    │  │   (E2E)     │  │  (Worker)   │  │   (DB)      │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Test Types

### Unit Tests
Fast, isolated tests for individual functions and components.

```typescript
// tests/unit/utils/format.test.ts
import { describe, it, expect } from 'vitest';
import { formatDuration, formatCredits, estimateCredits } from '@canvascast/shared/utils';

describe('formatDuration', () => {
  it('formats seconds only', () => {
    expect(formatDuration(5000)).toBe('5s');
  });
  
  it('formats minutes and seconds', () => {
    expect(formatDuration(125000)).toBe('2:05');
  });
  
  it('handles zero', () => {
    expect(formatDuration(0)).toBe('0s');
  });
});

describe('estimateCredits', () => {
  it('calculates base credits', () => {
    expect(estimateCredits(3, 'motivation')).toBe(3);
  });
  
  it('applies history multiplier', () => {
    expect(estimateCredits(3, 'history')).toBe(5);
  });
});
```

### Component Tests
Tests for React components with mocked dependencies.

```typescript
// tests/unit/components/JobStepper.test.tsx
import { render, screen } from '@testing-library/react';
import { JobStepper } from '@/components/JobStepper';

describe('JobStepper', () => {
  it('shows current step as active', () => {
    render(<JobStepper status="VOICE_GEN" progress={50} />);
    
    const voiceStep = screen.getByText('Generating Voice');
    expect(voiceStep).toHaveClass('active');
  });
  
  it('shows completed steps with checkmark', () => {
    render(<JobStepper status="VOICE_GEN" progress={50} />);
    
    const scriptStep = screen.getByTestId('step-SCRIPTING');
    expect(scriptStep).toHaveClass('completed');
  });
  
  it('shows pending steps as dimmed', () => {
    render(<JobStepper status="VOICE_GEN" progress={50} />);
    
    const renderStep = screen.getByTestId('step-RENDERING');
    expect(renderStep).toHaveClass('pending');
  });
});
```

### Integration Tests
Tests that verify multiple components working together.

```typescript
// tests/integration/api/projects.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '@/app';
import { createTestUser, createTestProject, cleanupTestData } from '../helpers';

describe('POST /api/v1/projects', () => {
  let authToken: string;
  let userId: string;
  
  beforeEach(async () => {
    const user = await createTestUser();
    authToken = user.token;
    userId = user.id;
  });
  
  afterEach(async () => {
    await cleanupTestData(userId);
  });
  
  it('creates project and queues job', async () => {
    const response = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Test Video',
        promptText: 'Create a motivational video about success',
        nichePreset: 'motivation',
        targetMinutes: 2,
      });
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('projectId');
    expect(response.body).toHaveProperty('jobId');
  });
  
  it('rejects with insufficient credits', async () => {
    // Use all credits first
    await useAllCredits(userId);
    
    const response = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Test Video',
        promptText: 'Create a video',
        nichePreset: 'motivation',
        targetMinutes: 2,
      });
    
    expect(response.status).toBe(402);
    expect(response.body.code).toBe('INSUFFICIENT_CREDITS');
  });
  
  it('validates required fields', async () => {
    const response = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });
});
```

### Database Tests
Tests for database functions and triggers.

```sql
-- tests/db/credit_functions.test.sql
BEGIN;
SELECT plan(5);

-- Test get_credit_balance
INSERT INTO auth.users (id, email) VALUES ('test-user-1', 'test@test.com');
INSERT INTO credit_ledger (user_id, type, amount) VALUES ('test-user-1', 'grant', 10);

SELECT is(
  get_credit_balance('test-user-1'),
  10,
  'get_credit_balance returns correct balance'
);

-- Test reserve_credits
SELECT ok(
  reserve_credits('test-user-1', 'test-job-1', 5),
  'reserve_credits succeeds with sufficient balance'
);

SELECT is(
  get_credit_balance('test-user-1'),
  5,
  'balance reduced after reservation'
);

-- Test insufficient balance
SELECT ok(
  NOT reserve_credits('test-user-1', 'test-job-2', 100),
  'reserve_credits fails with insufficient balance'
);

-- Test claim_draft_prompt
INSERT INTO draft_prompts (id, session_token, prompt_text) 
VALUES ('draft-1', 'token-abc', 'Test prompt');

SELECT is(
  claim_draft_prompt('token-abc', 'test-user-1'),
  'draft-1'::uuid,
  'claim_draft_prompt returns draft id'
);

SELECT * FROM finish();
ROLLBACK;
```

### E2E Tests
Full user flow tests with Playwright.

```typescript
// tests/e2e/create-video.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Video Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.click('button[type="submit"]');
    
    // Handle magic link (test mode)
    await page.goto('/auth/callback?token=test-token');
    await expect(page).toHaveURL('/app');
  });
  
  test('creates video from prompt', async ({ page }) => {
    // Navigate to new project
    await page.click('text=New Project');
    await expect(page).toHaveURL('/app/new');
    
    // Fill form
    await page.fill('[name="title"]', 'Test Video');
    await page.fill('[name="promptText"]', 'Create a motivational video about success');
    await page.selectOption('[name="nichePreset"]', 'motivation');
    await page.fill('[name="targetMinutes"]', '2');
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Wait for redirect to job page
    await expect(page).toHaveURL(/\/app\/jobs\/.+/);
    
    // Verify job started
    await expect(page.locator('[data-testid="job-status"]')).toContainText('SCRIPTING');
  });
  
  test('shows error for insufficient credits', async ({ page }) => {
    // Navigate to new project
    await page.goto('/app/new');
    
    // Fill form with high target minutes
    await page.fill('[name="title"]', 'Long Video');
    await page.fill('[name="promptText"]', 'Create a very long video');
    await page.fill('[name="targetMinutes"]', '10');
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Expect error
    await expect(page.locator('[role="alert"]')).toContainText('Insufficient credits');
  });
});
```

---

## 5. Pipeline Tests

### Step Unit Tests
```typescript
// tests/worker/steps/script-generation.test.ts
import { describe, it, expect, vi } from 'vitest';
import { generateScript } from '@/pipeline/steps/generate-script';
import { createMockContext } from '../helpers';

// Mock OpenAI
vi.mock('openai', () => ({
  default: class {
    chat = {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                title: 'Test Title',
                narrationText: 'Test narration...',
                scenes: [{ sceneId: 's1', caption: 'Test', imagePrompt: 'Test image' }],
              }),
            },
          }],
        }),
      },
    };
  },
}));

describe('generateScript', () => {
  it('generates script from prompt', async () => {
    const ctx = createMockContext({
      project: {
        prompt_text: 'Create a motivational video',
        niche_preset: 'motivation',
        target_minutes: 2,
      },
    });
    
    const result = await generateScript(ctx);
    
    expect(result.success).toBe(true);
    expect(result.data?.script.title).toBe('Test Title');
    expect(result.data?.script.scenes).toHaveLength(1);
  });
  
  it('handles LLM errors', async () => {
    const ctx = createMockContext({
      project: { prompt_text: 'Bad prompt' },
    });
    
    vi.mocked(openai.chat.completions.create).mockRejectedValueOnce(
      new Error('Rate limited')
    );
    
    const result = await generateScript(ctx);
    
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('SCRIPT_GENERATION_ERROR');
  });
});
```

### Pipeline Integration Test
```typescript
// tests/worker/pipeline.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runPipeline } from '@/pipeline/runner';
import { createTestJob, cleanupTestJob } from '../helpers';

describe('Pipeline Integration', () => {
  let jobId: string;
  
  beforeAll(async () => {
    const job = await createTestJob({
      title: 'Integration Test',
      promptText: 'Create a short test video',
      nichePreset: 'explainer',
      targetMinutes: 1,
    });
    jobId = job.id;
  });
  
  afterAll(async () => {
    await cleanupTestJob(jobId);
  });
  
  it('completes full pipeline', async () => {
    const result = await runPipeline(jobId);
    
    expect(result.status).toBe('READY');
    expect(result.artifacts.videoPath).toBeDefined();
    expect(result.artifacts.manifest).toBeDefined();
  }, 300000); // 5 min timeout
});
```

---

## 6. Test Helpers

### Factory Functions
```typescript
// tests/helpers/factories.ts
import { faker } from '@faker-js/faker';
import type { Project, Job, Profile } from '@canvascast/shared/types';

export function createMockProfile(overrides?: Partial<Profile>): Profile {
  return {
    id: faker.string.uuid(),
    display_name: faker.person.fullName(),
    avatar_url: faker.image.avatar(),
    notification_prefs: { job_complete: true, job_failed: true },
    stripe_customer_id: null,
    created_at: faker.date.recent().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    ...overrides,
  };
}

export function createMockProject(overrides?: Partial<Project>): Project {
  return {
    id: faker.string.uuid(),
    user_id: faker.string.uuid(),
    title: faker.lorem.sentence(4),
    prompt_text: faker.lorem.paragraph(),
    niche_preset: 'motivation',
    target_minutes: faker.number.int({ min: 1, max: 10 }),
    voice_profile_id: null,
    transcript_mode: 'auto',
    transcript_text: null,
    settings: {},
    created_at: faker.date.recent().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    ...overrides,
  };
}

export function createMockJob(overrides?: Partial<Job>): Job {
  return {
    id: faker.string.uuid(),
    project_id: faker.string.uuid(),
    user_id: faker.string.uuid(),
    status: 'PENDING',
    progress: 0,
    status_message: null,
    cost_credits_reserved: 0,
    cost_credits_final: null,
    failed_step: null,
    error_code: null,
    error_message: null,
    output_url: null,
    manifest_json: null,
    created_at: faker.date.recent().toISOString(),
    started_at: null,
    finished_at: null,
    ...overrides,
  };
}
```

### Database Helpers
```typescript
// tests/helpers/database.ts
import { supabase } from '@/lib/supabase';

export async function createTestUser(): Promise<{ id: string; token: string }> {
  const { data } = await supabase.auth.signUp({
    email: `test-${Date.now()}@test.com`,
    password: 'testpassword123',
  });
  
  return {
    id: data.user!.id,
    token: data.session!.access_token,
  };
}

export async function cleanupTestData(userId: string): Promise<void> {
  // Delete in order due to foreign keys
  await supabase.from('assets').delete().eq('user_id', userId);
  await supabase.from('job_steps').delete().match({ job_id: { user_id: userId } });
  await supabase.from('jobs').delete().eq('user_id', userId);
  await supabase.from('projects').delete().eq('user_id', userId);
  await supabase.from('credit_ledger').delete().eq('user_id', userId);
  await supabase.from('profiles').delete().eq('id', userId);
  await supabase.auth.admin.deleteUser(userId);
}

export async function grantTestCredits(userId: string, amount: number): Promise<void> {
  await supabase.rpc('add_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_type: 'grant',
    p_note: 'Test credits',
  });
}
```

---

## 7. Test Configuration

### Vitest Config
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules', 'tests'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Playwright Config
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## 8. CI/CD Integration

### GitHub Actions
```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm test:unit
      - uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: supabase/postgres
        env:
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
      redis:
        image: redis
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: pnpm db:migrate
      - run: pnpm test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: npx playwright install --with-deps
      - run: pnpm test:e2e
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 9. Test Commands

```bash
# Run all tests
pnpm test

# Unit tests
pnpm test:unit
pnpm test:unit --watch

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e
pnpm test:e2e --ui  # Interactive mode

# Database tests
pnpm test:db

# Coverage report
pnpm test:coverage

# Specific file/pattern
pnpm test:unit -- tests/unit/utils/format.test.ts
```

---

## 10. System Integration

### Communicates With

| Subsystem | Direction | Mechanism | Purpose |
|-----------|-----------|-----------|---------|
| **All Subsystems** | Tests → All | Direct import | Test execution |
| **Database** | Tests ↔ DB | Test database | Integration tests |
| **CI/CD** | CI → Tests | GitHub Actions | Automated runs |
| **Coverage** | Tests → Report | Codecov | Coverage tracking |

### Test Environment
```
┌─────────────────────────────────────────────────────────────────┐
│                     TEST ENVIRONMENT                             │
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │  Unit Tests  │     │ Integration  │     │  E2E Tests   │    │
│  │   (Vitest)   │     │   (Vitest)   │     │ (Playwright) │    │
│  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘    │
│         │                    │                    │             │
│         │                    ▼                    ▼             │
│         │            ┌──────────────┐    ┌──────────────┐      │
│         │            │  Test DB     │    │  Test Server │      │
│         │            │  (Postgres)  │    │  (localhost) │      │
│         │            └──────────────┘    └──────────────┘      │
│         │                    │                    │             │
│         └────────────────────┴────────────────────┘             │
│                              │                                  │
│                              ▼                                  │
│                      ┌──────────────┐                          │
│                      │   Coverage   │                          │
│                      │   Reports    │                          │
│                      └──────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. Files

| File | Purpose |
|------|---------|
| `tests/unit/` | Unit tests |
| `tests/integration/` | Integration tests |
| `tests/e2e/` | End-to-end tests |
| `tests/db/` | Database tests |
| `tests/helpers/` | Test utilities |
| `tests/fixtures/` | Test data |
| `vitest.config.ts` | Vitest configuration |
| `playwright.config.ts` | Playwright configuration |
| `.github/workflows/test.yml` | CI configuration |
