# GDP-006: Click Redirect Tracker - Implementation Summary

**Status:** ✅ Complete
**Completed:** 2026-01-26
**Feature ID:** GDP-006
**Priority:** P1

## Overview

Implemented the Click Redirect Tracker feature for the Growth Data Plane. This feature creates an attribution spine that tracks email link clicks through to session and conversion events using first-party cookies.

## What Was Implemented

### 1. Database Schema (Migration: `20260126000003_click_attribution.sql`)

Created the `click_attribution` table with the following structure:

```sql
CREATE TABLE click_attribution (
  id UUID PRIMARY KEY,
  email_message_id UUID REFERENCES email_message(id),
  click_token TEXT NOT NULL UNIQUE,
  link_url TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  clicked_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
```

**Indexes:**
- `idx_click_attribution_token` - Unique index on click_token for fast lookup
- `idx_click_attribution_email` - Index on email_message_id for joins
- `idx_click_attribution_clicked_at` - Index for time-based queries
- `idx_click_attribution_link_url` - Index for link analysis

**RLS Policies:**
- Service role policy for secure access

### 2. Database Functions

#### `generate_tracking_url(p_email_message_id, p_target_url, p_base_url)`
Generates tracking URLs for email links with URL encoding.

**Example:**
```sql
SELECT generate_tracking_url(
  'email-uuid-123',
  'https://example.com/pricing',
  'https://canvascast.com'
);
-- Returns: https://canvascast.com/click?email_id=email-uuid-123&target=https%3A%2F%2Fexample.com%2Fpricing
```

#### `get_click_attribution_by_token(p_click_token)`
Retrieves click attribution data by token for linking to sessions and conversions.

**Returns:**
- id, email_message_id, click_token, link_url, person_id, clicked_at

#### `urlencode(input)`
Helper function for URL encoding strings.

### 3. Edge Function (`supabase/functions/click-redirect/index.ts`)

Created Deno edge function that handles click tracking:

**Functionality:**
1. Accepts GET requests with `email_id` and `target` query parameters
2. Generates unique click token (format: `ct_{timestamp}_{random}`)
3. Records click in `click_attribution` table with user agent and IP address
4. Sets first-party cookie `_cc_click` with 30-day expiry
5. Redirects to target URL with HTTP 302

**Query Parameters:**
- `email_id` (required) - UUID of email_message record
- `target` (required) - Destination URL to redirect to

**Cookie Settings:**
- Name: `_cc_click`
- Max-Age: 2592000 seconds (30 days)
- Path: `/`
- SameSite: `Lax`
- Secure: Yes
- HttpOnly: Yes

**Example Usage:**
```
GET /click?email_id=123e4567-e89b-12d3-a456-426614174000&target=https://example.com/pricing

Response:
  Status: 302 Found
  Location: https://example.com/pricing
  Set-Cookie: _cc_click=ct_abc123_def456; Path=/; Max-Age=2592000; SameSite=Lax; Secure; HttpOnly
```

### 4. Tests

#### Unit Tests (`__tests__/supabase-functions/click-redirect.test.ts`)
- Click token generation uniqueness
- Click token format validation
- URL parameter validation
- Cookie configuration validation
- Edge function response structure

**8 tests** - ✅ All passing

#### Database Integration Tests (`__tests__/database/gdp-006-click-attribution.test.ts`)
- Table schema validation
- Click attribution record insertion
- Unique click_token constraint
- `generate_tracking_url` function
- URL encoding
- Custom base URL support
- `get_click_attribution_by_token` function
- Non-existent token handling

**8 tests** - ✅ All passing

## Attribution Flow

### Email → Click → Session → Conversion

1. **Email Sent**: Email message created with person_id
2. **Link Clicked**: User clicks tracking link in email
   - Edge function records click with unique token
   - First-party cookie set with click token
3. **Session Starts**: User browses site with cookie
   - Application can read `_cc_click` cookie
   - Link click to session via token
4. **Conversion**: User completes action
   - Attribution chain complete: email → click → session → conversion

## Files Created/Modified

### Created:
- `supabase/migrations/20260126000003_click_attribution.sql` - Database schema
- `supabase/functions/click-redirect/index.ts` - Edge function
- `__tests__/supabase-functions/click-redirect.test.ts` - Unit tests
- `__tests__/database/gdp-006-click-attribution.test.ts` - Integration tests
- `docs/GDP-006_IMPLEMENTATION_SUMMARY.md` - This file

### Modified:
- `feature_list.json` - Marked GDP-006 as complete, updated completedFeatures to 168

## Acceptance Criteria

✅ **Database Schema**
- click_attribution table created with all required columns
- Indexes created for performance
- RLS policies configured

✅ **Edge Function**
- Redirects to target URL with 302 status
- Sets first-party tracking cookie
- Records click event in database
- Validates required parameters
- Generates unique click tokens
- Captures user agent and IP address

✅ **Helper Functions**
- generate_tracking_url creates properly formatted URLs
- URL encoding works correctly
- get_click_attribution_by_token retrieves attribution data

✅ **Tests**
- All unit tests passing
- All integration tests passing
- Coverage for edge cases and error scenarios

## Next Steps

The following related features are still pending:

- **GDP-007**: Stripe Webhook Integration
- **GDP-008**: Subscription Snapshot
- **GDP-009**: PostHog Identity Stitching
- **GDP-010**: Meta Pixel + CAPI Dedup
- **GDP-011**: Person Features Computation
- **GDP-012**: Segment Engine

## Usage Example

### In Email Templates

When generating emails, use the `generate_tracking_url` function:

```typescript
// In email template generation
const trackingUrl = await supabase.rpc('generate_tracking_url', {
  p_email_message_id: emailMessage.id,
  p_target_url: 'https://canvascast.com/pricing',
});

// Use trackingUrl in email template
const emailHtml = `
  <a href="${trackingUrl}">View Pricing</a>
`;
```

### Reading Click Attribution in Application

```typescript
// Read _cc_click cookie from request
const clickToken = cookies.get('_cc_click');

if (clickToken) {
  // Get attribution data
  const { data } = await supabase.rpc('get_click_attribution_by_token', {
    p_click_token: clickToken,
  });

  if (data && data.length > 0) {
    const { person_id, email_message_id, link_url } = data[0];

    // Link session or conversion event to email click
    await trackConversion({
      person_id,
      source_email_message_id: email_message_id,
      attributed_link: link_url,
    });
  }
}
```

## Notes

- Cookie duration set to 30 days for long attribution window
- Click tokens use timestamp + random to ensure uniqueness
- Edge function continues redirect even if database insert fails (graceful degradation)
- IP address extraction supports X-Forwarded-For and X-Real-IP headers
- URL encoding handles special characters in target URLs

## Performance Considerations

- Unique index on `click_token` ensures fast lookups during attribution
- Index on `email_message_id` optimizes joins with email_message table
- Time-based index on `clicked_at` supports reporting queries
- Edge function uses minimal database writes (single INSERT)

## Security

- RLS policies restrict access to service_role
- HttpOnly cookie prevents JavaScript access
- Secure flag ensures HTTPS-only transmission
- SameSite=Lax prevents CSRF attacks
- No sensitive data exposed in query parameters beyond UUID
