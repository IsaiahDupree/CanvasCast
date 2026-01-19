# PRD: End-to-End Testing Standards

> **Version:** 1.0  
> **Created:** Jan 19, 2026  
> **Status:** Active

---

## Table of Contents

1. [Overview](#overview)
2. [Test Categories](#test-categories)
3. [Debug Logging Standards](#debug-logging-standards)
4. [Test File Structure](#test-file-structure)
5. [Running Tests](#running-tests)
6. [Test Coverage Requirements](#test-coverage-requirements)

---

## Overview

This PRD defines the standards for end-to-end (E2E) integration testing in CanvasCast. All E2E tests must include comprehensive console logging for debugging pipeline issues, tracking test progress, and diagnosing failures.

### Goals

- **Visibility** — Every test step logs its actions and results
- **Debuggability** — Failed tests provide enough context to diagnose issues
- **Traceability** — Test timelines show exact sequence of operations
- **Consistency** — All tests follow the same logging patterns

---

## Test Categories

### 1. Pipeline Step Tests (`pipeline-steps-e2e.test.ts`)

Tests individual pipeline steps with detailed logging:

| Step | Test Coverage |
|------|---------------|
| SCRIPTING | Script generation, section count, content quality |
| VOICE_GEN | TTS provider selection, fallback handling, audio output |
| ALIGNMENT | Caption timing, word-level sync accuracy |
| IMAGE_GEN | Image generation count, quality, storage |
| RENDERING | Video composition, output format, duration |
| PACKAGING | Asset bundling, ZIP creation, file integrity |

**Logging Requirements:**
- Log step start/end with timestamps
- Log intermediate progress (e.g., "Generated 5/38 images")
- Log any fallback triggers
- Log final artifacts produced

### 2. API Endpoint Tests (`api-e2e.test.ts`)

Tests all public and authenticated API endpoints:

| Endpoint | Tests |
|----------|-------|
| `/api/draft` | Create, retrieve, validate drafts |
| `/api/projects` | CRUD operations, auth checks |
| `/api/projects/[id]/generate` | Job creation, credit reservation |
| `/api/projects/[id]/downloads` | Signed URL generation |
| `/api/stripe/webhook` | Signature validation |

**Logging Requirements:**
- Log HTTP method, URL, request body
- Log response status and body
- Log response time
- Log auth state

### 3. Worker Tests (`worker-e2e.test.ts`)

Tests worker job processing:

| Area | Tests |
|------|-------|
| Job Claiming | RPC function, worker ID assignment |
| Stale Recovery | Detection, re-queue mechanism |
| Progress Monitoring | Status transitions, timeline tracking |
| Credit Management | Reservation, release, final charge |
| Asset Storage | Bucket access, upload/download |

**Logging Requirements:**
- Log job ID and status at each transition
- Log worker ID claiming jobs
- Log stale job detection criteria
- Log storage operations

### 4. Database Tests (`database-e2e.test.ts`)

Tests database operations and integrity:

| Area | Tests |
|------|-------|
| Table Structure | All required tables exist |
| CRUD Operations | Create, read, update, delete |
| RPC Functions | Credit balance, job claiming |
| Concurrent Operations | Race condition handling |

**Logging Requirements:**
- Log query type and parameters
- Log result counts
- Log errors with full context
- Log timing for performance tracking

---

## Debug Logging Standards

### Logger Utility

All E2E tests must use this standardized logger:

```typescript
function debugLog(context: string, message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${context}] ${message}`);
  if (data !== undefined) {
    console.log(`  └─ Data:`, JSON.stringify(data, null, 2));
  }
}
```

### Context Labels

| Context | Usage |
|---------|-------|
| `TEST` | Test case start |
| `SETUP` | Test setup/fixture creation |
| `INPUT` | Input data being used |
| `REQUEST` | API request being made |
| `RESPONSE` | API response received |
| `STATUS` | Status change detected |
| `TRANSITION` | State transition |
| `SUCCESS` | Operation succeeded |
| `ERROR` | Operation failed |
| `SKIP` | Test skipped (with reason) |
| `CLEANUP` | Test cleanup |
| `RESULT` | Final test result |

### Example Logging Output

```
[2026-01-19T18:30:00.000Z] [TEST] Starting SCRIPTING step test
[2026-01-19T18:30:00.050Z] [SETUP] Created project: abc123-def456
[2026-01-19T18:30:00.100Z] [INPUT] Added content to project
  └─ Data: { "wordCount": 150, "source": "e2e-test" }
[2026-01-19T18:30:00.150Z] [STATUS] Job abc123 → SCRIPTING (10%)
[2026-01-19T18:30:05.200Z] [STATUS] Job abc123 → VOICE_GEN (30%)
[2026-01-19T18:30:10.300Z] [SUCCESS] Pipeline reached target status
[2026-01-19T18:30:10.350Z] [RESULT] Test passed in 10.35s
```

---

## Test File Structure

### Directory Layout

```
tests/
├── integration/
│   ├── api-e2e.test.ts          # API endpoint tests
│   ├── database-e2e.test.ts     # Database operation tests
│   ├── full-video-generation.test.ts  # Full pipeline E2E
│   ├── pipeline-e2e.test.ts     # Pipeline lifecycle tests
│   ├── pipeline-steps-e2e.test.ts     # Individual step tests
│   ├── video-generation.test.ts # Generation config tests
│   └── worker-e2e.test.ts       # Worker process tests
├── e2e/
│   ├── auth.spec.ts             # Playwright auth flows
│   ├── dashboard.spec.ts        # Dashboard UI tests
│   ├── project-flow.spec.ts     # Project creation UI
│   └── ...
├── db/
│   ├── rls.test.ts              # Row-level security
│   └── rpc.test.ts              # RPC function tests
├── unit/
│   └── ...
└── fixtures/
    └── ...
```

### Test File Template

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

// ============================================
// [TEST CATEGORY] E2E TESTS WITH DEBUG LOGGING
// ============================================
// Description of what these tests cover

const SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "...";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Debug logger
function debugLog(context: string, message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [CATEGORY-E2E] [${context}] ${message}`);
  if (data !== undefined) {
    console.log(`  └─ Data:`, JSON.stringify(data, null, 2));
  }
}

describe("Category E2E - Feature Group", () => {
  let testResourceId: string | null = null;

  beforeAll(() => {
    debugLog("SETUP", "Initializing test suite");
  });

  afterAll(async () => {
    debugLog("CLEANUP", "Cleaning up test resources");
    // Cleanup code
  });

  it("describes what the test verifies", async () => {
    debugLog("TEST", "Starting test: [test name]");

    // Test implementation with logging

    debugLog("RESULT", "Test completed", { success: true });
    expect(true).toBe(true);
  });
});
```

---

## Running Tests

### Commands

```bash
# Run all integration tests (no worker required)
pnpm test:integration

# Run full E2E with worker (requires worker running)
pnpm test:integration:full

# Run specific test file with verbose output
pnpm vitest run tests/integration/pipeline-steps-e2e.test.ts

# Run with watch mode for development
pnpm vitest tests/integration/worker-e2e.test.ts

# Run E2E browser tests (Playwright)
pnpm test:e2e

# Run with UI for debugging
pnpm test:e2e:ui
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Database URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key for admin access |
| `API_BASE_URL` | No | Web app URL (default: localhost:3000) |
| `TEST_USER_EMAIL` | No | Email for authenticated tests |

### Timeouts

| Test Type | Default Timeout |
|-----------|----------------|
| Unit tests | 5 seconds |
| Integration tests | 30 seconds |
| Pipeline step tests | 150 seconds |
| Full pipeline tests | 700 seconds (11+ min) |

---

## Test Coverage Requirements

### Minimum Coverage

| Area | Required |
|------|----------|
| Pipeline steps | 100% of steps tested |
| API endpoints | All public endpoints |
| Error scenarios | At least 5 error cases |
| Edge cases | Empty input, concurrent ops |

### Logging Coverage

Every test must log:
1. **Test start** — What the test is verifying
2. **Key operations** — Database writes, API calls
3. **State changes** — Status transitions, progress updates
4. **Test result** — Success/failure with context
5. **Cleanup** — Resources being removed

### Required Assertions

```typescript
// ✅ Good - includes logging and clear assertion
debugLog("TEST", "Verifying project creation");
const { data, error } = await supabase.from("projects").insert({...}).select().single();
debugLog("RESULT", `Created project: ${data?.id}`, { error: error?.message });
expect(error).toBeNull();
expect(data.title).toBe("Expected Title");

// ❌ Bad - no logging, unclear what's being tested
const { data } = await supabase.from("projects").insert({...}).select().single();
expect(data).toBeDefined();
```

---

## Test Maintenance

### Adding New Tests

1. Identify the category (API, Worker, Database, Pipeline)
2. Add to appropriate `*-e2e.test.ts` file
3. Include debug logging at all key points
4. Add cleanup in `afterAll` or `afterEach`
5. Document timeout requirements if non-standard

### Debugging Failed Tests

1. Run test in isolation: `pnpm vitest run [file] -t "[test name]"`
2. Review console output for last successful log
3. Check for missing cleanup from previous runs
4. Verify environment variables are set
5. Check if worker is running (for pipeline tests)

### Common Issues

| Issue | Solution |
|-------|----------|
| "Skipping - no project" | Previous test failed, check setup |
| Timeout errors | Increase timeout or check worker |
| "Cannot create project" | Check RLS policies or user exists |
| Empty events/assets | Worker not processing jobs |

---

## Appendix: Test Files Summary

| File | Tests | Requires Worker | Logging |
|------|-------|-----------------|---------|
| `pipeline-steps-e2e.test.ts` | 15+ | Yes | Full debug |
| `api-e2e.test.ts` | 12+ | No | Full debug |
| `worker-e2e.test.ts` | 10+ | Optional | Full debug |
| `database-e2e.test.ts` | 20+ | No | Full debug |
| `full-video-generation.test.ts` | 5+ | Yes | Full debug |
| `pipeline-e2e.test.ts` | 15+ | No | Full debug |
| `video-generation.test.ts` | 25+ | No | Partial |

---

*Last updated: Jan 19, 2026*
