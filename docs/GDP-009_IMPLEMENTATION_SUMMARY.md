# GDP-009: PostHog Identity Stitching - Implementation Summary

## Overview
Implemented PostHog identity stitching to link anonymous pre-auth sessions with identified users after login/signup. This enables tracking of the complete user journey from first landing page visit through conversion.

## Implementation Details

### 1. New Function: `identifyUserForPostHog`
**Location:** `apps/web/src/lib/analytics.ts`

```typescript
export async function identifyUserForPostHog(
  userId: string,
  properties?: AnalyticsEventProperties
): Promise<void>
```

**Purpose:**
- Dedicated function for PostHog identity stitching
- Called on every login/signup to link anonymous sessions to authenticated users
- Automatically handles session stitching when `posthog.identify()` is called

**Features:**
- Guards against missing userId or uninitialized PostHog
- Error handling to prevent crashes
- Accepts any user properties for enriched user profiles

### 2. Integration Point: ActivationTracker
**Location:** `apps/web/src/components/ActivationTracker.tsx`

The identity stitching is triggered in the `ActivationTracker` component which runs on every authenticated page load:

```typescript
// GDP-009: PostHog Identity Stitching
identifyUserForPostHog(user.id, userTraits);
```

**When it runs:**
- On first load of `/app` after authentication
- Includes comprehensive user traits:
  - email
  - created_at
  - plan (subscription tier)
  - credits balance
  - Stripe customer status

**Session tracking:**
- Uses `sessionStorage` to track per-session to avoid duplicate calls
- Key: `activation_tracked_${user.id}`

### 3. How Identity Stitching Works

#### Pre-Auth Journey
1. User lands on site (anonymous PostHog distinct_id created)
2. User browses pages, watches demos (events tracked with anonymous ID)
3. User enters prompt (saved as draft with session cookie)
4. User clicks "Get Started"

#### Auth Flow
5. User signs up/logs in (via email magic link or Google OAuth)
6. Supabase creates user account with UUID
7. Auth callback redirects to `/app`

#### Post-Auth Stitching
8. `ActivationTracker` mounts in app layout
9. `identifyUserForPostHog(userId, traits)` is called
10. PostHog receives identify call with Supabase user ID
11. PostHog **automatically** links:
    - All previous anonymous events to the user ID
    - All future events to the user ID
12. Complete user journey is now attributed to one user

### 4. Person ID Consistency
**Person ID = Supabase User ID**

- The Supabase `user.id` (UUID) is used as the PostHog distinct_id
- This ensures consistency across all systems:
  - Database queries
  - API calls
  - Analytics events
  - Meta Pixel events (via CAPI)

## Testing

### Test Coverage
**Location:** `apps/web/__tests__/posthog-identity-stitching.test.ts`

**Tests (11 total, all passing):**
1. ✅ Calls posthog.identify with user ID and properties
2. ✅ Handles missing email gracefully
3. ✅ Does not call identify if user ID is missing
4. ✅ Handles errors gracefully without throwing
5. ✅ Stitches anonymous session to identified user
6. ✅ Works with minimal properties
7. ✅ Passes through all custom properties
8. ✅ Does not call identify if PostHog is not initialized
9. ✅ Identifies user after successful login
10. ✅ Identifies user after successful OAuth signup
11. ✅ Uses Supabase user ID as person ID

### Test Results
```bash
pnpm --filter @canvascast/web test posthog-identity-stitching.test.ts
# ✓ All 11 tests passed
```

## User Journey Example

### Complete Attribution Flow

```
┌─────────────────────────────────────────────────────────────┐
│ ANONYMOUS SESSION                                            │
│ distinct_id: "anon_abc123xyz"                               │
├─────────────────────────────────────────────────────────────┤
│ Event: landing_view                                          │
│ Event: cta_click                                             │
│ Event: pricing_view                                          │
│ Event: prompt_submitted (draft created)                      │
└─────────────────────────────────────────────────────────────┘
                           ↓
                    [User Signs Up]
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ IDENTITY STITCHING                                           │
│ posthog.identify("user-uuid-123", { email, plan, ... })    │
├─────────────────────────────────────────────────────────────┤
│ PostHog merges "anon_abc123xyz" → "user-uuid-123"          │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ IDENTIFIED SESSION                                           │
│ distinct_id: "user-uuid-123"                                │
├─────────────────────────────────────────────────────────────┤
│ Historical Events (now attributed to user):                  │
│   - landing_view                                             │
│   - cta_click                                                │
│   - pricing_view                                             │
│   - prompt_submitted                                         │
│                                                              │
│ New Events:                                                  │
│   - login_success                                            │
│   - activation_complete                                      │
│   - project_created                                          │
│   - video_generated                                          │
│   - purchase_completed                                       │
└─────────────────────────────────────────────────────────────┘
```

## Benefits

### 1. Complete Funnel Attribution
- Track users from first visit through conversion
- Understand which marketing channels drive signups AND purchases
- Calculate true customer acquisition costs

### 2. Behavioral Insights
- See what anonymous users do before signing up
- Identify friction points in pre-signup journey
- A/B test landing page changes with conversion impact

### 3. Retention Analysis
- Track returning users across sessions
- Understand what drives user activation
- Measure feature adoption over time

### 4. Compliance
- All tracking respects cookie consent (GDPR-004)
- PII is only collected post-auth
- Users can delete their data (GDPR-002)

## Related Features

### Connected Systems
- **TRACK-008:** User Identification (calls both functions)
- **META-005:** Event deduplication (uses same person ID)
- **GDP-002:** Person & Identity tables (uses Supabase user ID)
- **GDP-003:** Unified events table (receives all events)

### Next Steps
- **GDP-010:** Meta Pixel + CAPI deduplication (use same event_id)
- **GDP-011:** Person features computation (aggregate by person_id)
- **GDP-012:** Segment engine (target by behavior)

## Configuration

### Environment Variables
```bash
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxxxxxxxxxx
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com  # or self-hosted
```

### Cookie Consent
Identity stitching only runs if user has accepted analytics cookies:
```typescript
localStorage.getItem('cookie-consent')
// { analytics: true }
```

## Verification

### Manual Testing
1. Open incognito window
2. Visit landing page (PostHog creates anonymous ID)
3. Browse site, click CTAs
4. Sign up with new account
5. Check PostHog debugger - should see:
   - Previous anonymous events linked to new user ID
   - New identified events with same user ID

### PostHog Dashboard
Check the "Persons" tab to verify:
- User ID = Supabase UUID
- Properties include email, plan, credits
- Event timeline shows pre and post-auth events

## Status
✅ **COMPLETE** - Feature tested and integrated

## Related Files
- `apps/web/src/lib/analytics.ts` - Core implementation
- `apps/web/src/components/ActivationTracker.tsx` - Integration point
- `apps/web/__tests__/posthog-identity-stitching.test.ts` - Test suite
- `docs/GDP-009_IMPLEMENTATION_SUMMARY.md` - This file
