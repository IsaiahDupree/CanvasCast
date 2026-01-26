# Resend Webhook Edge Function

## Overview

This Supabase Edge Function handles webhooks from Resend for email tracking events. It's part of the **Growth Data Plane (GDP-004)** feature that tracks email delivery, opens, clicks, bounces, and complaints.

## Features

- ✅ **Svix Signature Verification**: Validates webhook authenticity using Svix signatures
- ✅ **Email Event Tracking**: Stores all email events in the database
- ✅ **Person ID Mapping**: Links emails to users via tags
- ✅ **Comprehensive Event Support**:
  - `email.delivered` - Email successfully delivered
  - `email.opened` - Recipient opened the email
  - `email.clicked` - Recipient clicked a link
  - `email.bounced` - Email bounced
  - `email.complained` - Recipient marked as spam

## Database Schema

The function uses the following tables from the Growth Data Plane migration:

### `email_message`
Stores metadata about sent emails:
- `id` - Primary key
- `person_id` - Link to person table (from tags)
- `resend_email_id` - Resend's email ID (unique)
- `subject`, `to_address`, `from_address` - Email details
- `tags` - JSONB array of tags
- `sent_at` - Timestamp

### `email_event`
Tracks email engagement events:
- `id` - Primary key
- `email_message_id` - Foreign key to email_message
- `event_type` - Type: delivered, opened, clicked, bounced, complained
- `link_url` - URL clicked (for click events)
- `user_agent`, `ip_address` - User context (for click/open events)
- `occurred_at` - Event timestamp

## Environment Variables

### Required
- `SUPABASE_URL` - Automatically provided by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Automatically provided by Supabase

### Optional
- `RESEND_WEBHOOK_SECRET` - Svix webhook signing secret from Resend dashboard
  - If not set, signature verification is skipped (not recommended for production)

## Deployment

### Deploy to Supabase

```bash
# Deploy the function
supabase functions deploy resend-webhook

# Set the webhook secret (if not already set)
supabase secrets set RESEND_WEBHOOK_SECRET=whsec_your_secret_here
```

### Get the Function URL

After deployment, the function URL will be:
```
https://<project-ref>.supabase.co/functions/v1/resend-webhook
```

## Configure Resend Webhook

1. Go to [Resend Dashboard](https://resend.com/webhooks)
2. Click "Add Webhook"
3. Enter the function URL: `https://<project-ref>.supabase.co/functions/v1/resend-webhook`
4. Select events to track:
   - ✅ `email.delivered`
   - ✅ `email.opened`
   - ✅ `email.clicked`
   - ✅ `email.bounced`
   - ✅ `email.complained`
5. Copy the **Signing Secret** (starts with `whsec_`)
6. Set it as environment variable:
   ```bash
   supabase secrets set RESEND_WEBHOOK_SECRET=whsec_...
   ```

## Person ID Mapping

To link emails to specific users in the Growth Data Plane:

### When Sending Emails

Include a `person_id` tag when sending emails via Resend:

```typescript
import { resend } from './lib/resend';

await resend.emails.send({
  from: 'CanvasCast <hello@canvascast.com>',
  to: 'user@example.com',
  subject: 'Welcome to CanvasCast',
  html: '<h1>Welcome!</h1>',
  tags: [
    { name: 'person_id', value: 'uuid-of-person-record' },
    { name: 'template', value: 'welcome' },
  ],
});
```

### How It Works

1. When Resend sends the email, it includes the tags in the webhook payload
2. The edge function extracts the `person_id` tag
3. The `email_message` record is linked to that person
4. Email events (opens, clicks) can be attributed to that person

## Testing

### Local Testing

```bash
# Start Supabase locally
supabase start

# Serve the function locally
supabase functions serve resend-webhook

# Test with curl (in another terminal)
curl -X POST http://localhost:54321/functions/v1/resend-webhook \
  -H "Content-Type: application/json" \
  -H "svix-id: msg_test" \
  -H "svix-timestamp: $(date +%s)" \
  -H "svix-signature: valid" \
  -d '{
    "type": "email.delivered",
    "created_at": "2026-01-26T12:00:00Z",
    "data": {
      "email_id": "test-email-123",
      "to": "user@example.com",
      "from": "hello@canvascast.com",
      "subject": "Test Email",
      "tags": [
        {"name": "person_id", "value": "550e8400-e29b-41d4-a716-446655440000"}
      ]
    }
  }'
```

### Unit Tests

Run the test suite:

```bash
pnpm test __tests__/supabase-functions/resend-webhook.test.ts
```

## Monitoring

### View Function Logs

```bash
supabase functions logs resend-webhook
```

### Check Database Records

```sql
-- View recent email messages
SELECT * FROM email_message ORDER BY created_at DESC LIMIT 10;

-- View recent email events
SELECT
  em.subject,
  em.to_address,
  ee.event_type,
  ee.occurred_at
FROM email_event ee
JOIN email_message em ON ee.email_message_id = em.id
ORDER BY ee.occurred_at DESC
LIMIT 20;

-- View events for a specific person
SELECT
  em.subject,
  ee.event_type,
  ee.link_url,
  ee.occurred_at
FROM email_event ee
JOIN email_message em ON ee.email_message_id = em.id
WHERE em.person_id = 'uuid-here'
ORDER BY ee.occurred_at DESC;
```

## Error Handling

The function handles errors gracefully:

- **400 Bad Request** - Missing Svix signature headers
- **401 Unauthorized** - Invalid Svix signature
- **500 Internal Server Error** - Database or processing errors

All errors are logged to the function logs for debugging.

## Idempotency

The function uses `upsert` with `onConflict: 'resend_email_id'` to prevent duplicate email_message records. Email events are inserted without duplicate checking, as multiple opens/clicks are expected.

## Security

- **Signature Verification**: Uses Svix to verify webhook authenticity
- **Service Role Key**: Uses Supabase service role key to bypass RLS
- **RLS Policies**: All tables have service_role-only policies

## Related Features

- **GDP-005**: Email Event Tracking (builds on this)
- **GDP-006**: Click Redirect Tracker (attribution spine)
- **GDP-009**: PostHog Identity Stitching
- **GDP-012**: Segment Engine (uses email events for automation)

## Troubleshooting

### Webhook Not Received

1. Check Resend webhook configuration
2. Verify function is deployed: `supabase functions list`
3. Check function logs: `supabase functions logs resend-webhook`
4. Test webhook manually with curl

### Signature Verification Failed

1. Verify `RESEND_WEBHOOK_SECRET` is set correctly
2. Check that secret matches Resend dashboard
3. Ensure webhook headers are not modified by proxies

### Database Errors

1. Verify Growth Data Plane migration is applied
2. Check table permissions
3. Verify person_id exists in person table (if using tags)

## Next Steps

1. **GDP-005**: Implement email event tracking in analytics
2. **GDP-006**: Build click redirect tracker for attribution
3. **GDP-012**: Create segment engine to trigger automations based on email engagement
