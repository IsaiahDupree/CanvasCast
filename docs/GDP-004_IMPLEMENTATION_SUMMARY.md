# GDP-004: Resend Webhook Edge Function - Implementation Summary

**Status:** ✅ Complete
**Date:** 2026-01-26
**Feature ID:** GDP-004
**Category:** Growth Data Plane

## Overview

Implemented a Supabase Edge Function to receive and process webhooks from Resend for email event tracking. This enables the Growth Data Plane to track email delivery, engagement (opens, clicks), and issues (bounces, complaints).

## What Was Built

### 1. Supabase Edge Function (`supabase/functions/resend-webhook/`)

**Location:** `supabase/functions/resend-webhook/index.ts`

**Features:**
- ✅ Verifies Svix webhook signatures for security
- ✅ Processes 5 email event types:
  - `email.delivered` - Creates email_message record
  - `email.opened` - Tracks email opens
  - `email.clicked` - Tracks link clicks with URL and user context
  - `email.bounced` - Tracks email bounces
  - `email.complained` - Tracks spam complaints
- ✅ Maps emails to person records via tags
- ✅ Stores event data in Growth Data Plane tables
- ✅ Graceful error handling with proper HTTP status codes
- ✅ Idempotent email_message creation with upsert

### 2. Database Schema (Previously Completed in GDP-001)

Uses existing tables from `supabase/migrations/20260126000001_growth_data_plane.sql`:

**`email_message` table:**
- Stores sent email metadata
- Links to `person` table via `person_id`
- Unique constraint on `resend_email_id`
- JSONB `tags` field for flexible metadata

**`email_event` table:**
- Tracks engagement events
- Links to `email_message` via foreign key
- Supports click tracking with `link_url`, `user_agent`, `ip_address`
- Timestamp tracking with `occurred_at`

### 3. Tests

**Unit Tests:** `__tests__/supabase-functions/resend-webhook.test.ts`
- 13 test cases covering:
  - Signature verification (valid/invalid)
  - All 5 event types
  - Person ID mapping via tags
  - Error handling (missing headers, DB errors)
  - Unknown event type handling
  - Idempotency

**Integration Tests:** `__tests__/database/gdp-004-resend-webhook.test.ts`
- 6 test cases covering:
  - Table existence validation
  - Email message creation with person_id
  - Email event creation
  - Click event with metadata
  - Upsert behavior
- ✅ All tests passing

### 4. Documentation

**README:** `supabase/functions/resend-webhook/README.md`
- Deployment instructions
- Resend webhook configuration
- Person ID mapping guide
- Testing procedures
- Monitoring queries
- Troubleshooting guide

**Environment Documentation:** Updated `docs/ENVIRONMENT.md`
- Added `RESEND_WEBHOOK_SECRET` variable
- Configuration instructions

## Architecture

```
Resend → Webhook Event → Supabase Edge Function
                              ↓
                      Verify Svix Signature
                              ↓
                      Parse Webhook Payload
                              ↓
                Extract person_id from tags (if present)
                              ↓
                    Process Event by Type
                              ↓
          ┌─────────────────────────────────┐
          ↓                                 ↓
    email_message                    email_event
    (delivered only)              (all event types)
          ↓                                 ↓
    Linked to person              Linked to email_message
```

## Person ID Mapping Flow

1. **Sending Email with Tags:**
```typescript
await resend.emails.send({
  to: 'user@example.com',
  subject: 'Welcome',
  html: '<h1>Welcome!</h1>',
  tags: [
    { name: 'person_id', value: 'uuid-of-person' },
    { name: 'template', value: 'welcome' }
  ]
});
```

2. **Webhook Receives Tags:**
```json
{
  "type": "email.delivered",
  "data": {
    "email_id": "abc123",
    "tags": [
      {"name": "person_id", "value": "uuid-of-person"}
    ]
  }
}
```

3. **Edge Function Extracts person_id:**
```typescript
const personIdTag = payload.data.tags.find(t => t.name === 'person_id');
const personId = personIdTag?.value || null;
```

4. **Database Record Created:**
```sql
INSERT INTO email_message (person_id, resend_email_id, ...)
VALUES ('uuid-of-person', 'abc123', ...);
```

## Security Features

1. **Svix Signature Verification:**
   - Validates webhook authenticity
   - Prevents replay attacks
   - Uses RESEND_WEBHOOK_SECRET

2. **Row Level Security:**
   - All tables protected with RLS
   - service_role-only access
   - No public access to webhook data

3. **Error Handling:**
   - 400 for missing headers
   - 401 for invalid signatures
   - 500 for internal errors
   - All errors logged for debugging

## Deployment Checklist

- [x] Edge function created in `supabase/functions/resend-webhook/`
- [x] Database schema exists (from GDP-001 migration)
- [x] Tests written and passing
- [x] Documentation created
- [x] Environment variables documented
- [ ] Deploy to Supabase: `supabase functions deploy resend-webhook`
- [ ] Set RESEND_WEBHOOK_SECRET: `supabase secrets set RESEND_WEBHOOK_SECRET=whsec_...`
- [ ] Configure webhook in Resend dashboard
- [ ] Test with real webhook event
- [ ] Monitor function logs

## Integration with Other Features

### Already Integrated:
- **GDP-001**: Uses Growth Data Plane schema (person, identity_link, email_message, email_event)

### Future Integration Points:
- **GDP-005**: Email Event Tracking - Will aggregate events for analytics
- **GDP-006**: Click Redirect Tracker - Will use click events for attribution
- **GDP-009**: PostHog Identity Stitching - Can correlate email engagement with web events
- **GDP-011**: Person Features Computation - Will compute email_opens metric
- **GDP-012**: Segment Engine - Will trigger automations based on email engagement

## Monitoring Queries

### View Recent Email Events
```sql
SELECT
  em.subject,
  em.to_address,
  ee.event_type,
  ee.link_url,
  ee.occurred_at
FROM email_event ee
JOIN email_message em ON ee.email_message_id = em.id
ORDER BY ee.occurred_at DESC
LIMIT 20;
```

### Track Engagement by Person
```sql
SELECT
  p.email,
  COUNT(CASE WHEN ee.event_type = 'opened' THEN 1 END) as opens,
  COUNT(CASE WHEN ee.event_type = 'clicked' THEN 1 END) as clicks
FROM person p
LEFT JOIN email_message em ON p.id = em.person_id
LEFT JOIN email_event ee ON em.id = ee.email_message_id
GROUP BY p.id, p.email
ORDER BY opens DESC, clicks DESC;
```

### Check Webhook Processing Health
```sql
SELECT
  DATE(sent_at) as date,
  COUNT(*) as emails_sent,
  COUNT(DISTINCT person_id) as unique_recipients
FROM email_message
WHERE sent_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(sent_at)
ORDER BY date DESC;
```

## Known Limitations

1. **Multiple Opens/Clicks**: Email events are not deduplicated. Multiple opens by the same recipient will create multiple records. This is intentional for engagement tracking.

2. **Missing Email Message**: If an open/click event arrives before the delivered event, it will be logged with a warning but not stored. This is rare but possible due to webhook delivery order.

3. **Signature Verification Optional**: If RESEND_WEBHOOK_SECRET is not set, signature verification is skipped. This should only be used in development.

## Acceptance Criteria

✅ **All criteria met:**

- [x] Verifies Svix signature from Resend webhooks
- [x] Stores email.delivered events in email_message table
- [x] Stores email.opened, clicked, bounced, complained events in email_event table
- [x] Extracts person_id from tags and links to person table
- [x] Handles all 5 event types (delivered, opened, clicked, bounced, complained)
- [x] Returns appropriate HTTP status codes (200, 400, 401, 500)
- [x] Logs errors for debugging
- [x] Tests pass (unit + integration)
- [x] Documentation complete

## Files Created/Modified

### Created:
- `supabase/functions/resend-webhook/index.ts` - Main edge function
- `supabase/functions/resend-webhook/deno.json` - Deno configuration
- `supabase/functions/resend-webhook/README.md` - Function documentation
- `__tests__/supabase-functions/resend-webhook.test.ts` - Unit tests
- `__tests__/database/gdp-004-resend-webhook.test.ts` - Integration tests
- `docs/GDP-004_IMPLEMENTATION_SUMMARY.md` - This file

### Modified:
- `docs/ENVIRONMENT.md` - Added RESEND_WEBHOOK_SECRET
- `feature_list.json` - Marked GDP-004 as complete (passes: true)

## Next Steps

1. **Deploy to Supabase:**
   ```bash
   supabase functions deploy resend-webhook
   supabase secrets set RESEND_WEBHOOK_SECRET=whsec_your_secret
   ```

2. **Configure Resend Webhook:**
   - Add webhook URL in Resend dashboard
   - Copy signing secret
   - Test with a test email

3. **Implement GDP-005: Email Event Tracking**
   - Build analytics on top of email_event data
   - Track funnel metrics (delivered → opened → clicked)

4. **Update Email Sending Code:**
   - Add person_id tags to all Resend email.send() calls
   - Example in worker's notify service

## Success Metrics

Once deployed, success will be measured by:

- ✅ Webhook events successfully received and processed
- ✅ No signature verification failures
- ✅ Email messages linked to correct person records
- ✅ All event types tracked (open, click, bounce rates visible)
- ✅ Zero downtime or errors in function logs

## Conclusion

GDP-004 is **complete and tested**. The Resend webhook edge function is ready for deployment and will provide comprehensive email tracking for the Growth Data Plane. This enables email engagement analytics, segmentation, and automation workflows.

---

**Implemented by:** Claude Sonnet 4.5
**Date:** 2026-01-26
**Test Status:** ✅ All tests passing (19/19)
**Ready for Production:** ✅ Yes (after deployment)
