# Stripe Webhook Edge Function (GDP-007)

This Supabase Edge Function handles webhooks from Stripe for subscription-related events. It maps Stripe customers to persons in the Growth Data Plane and maintains subscription state.

## Features

- **Signature Verification**: Verifies Stripe webhook signatures using the webhook secret
- **Person Identity Mapping**: Links Stripe customer IDs to person records via `identity_link` table
- **Subscription Tracking**: Creates and updates subscription records in the Growth Data Plane
- **Event Logging**: Records all subscription events in the unified `event` table

## Supported Events

- `customer.subscription.created` - New subscription created
- `customer.subscription.updated` - Subscription status or plan changed
- `customer.subscription.deleted` - Subscription canceled/deleted
- `invoice.paid` - Subscription payment succeeded
- `invoice.payment_failed` - Subscription payment failed

## Environment Variables

Required environment variables:

- `STRIPE_SECRET_KEY` - Your Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for bypassing RLS)

## Database Schema

The function interacts with these tables:

- `person` - Canonical person/user records
- `identity_link` - Maps external IDs (Stripe customer) to person IDs
- `subscription` - Subscription snapshots with MRR and status
- `event` - Unified event stream from all sources

## Deployment

Deploy the function using the Supabase CLI:

```bash
supabase functions deploy stripe-webhook
```

Set environment variables:

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set STRIPE_SECRET_KEY=sk_...
```

## Stripe Configuration

1. In Stripe Dashboard, go to **Developers > Webhooks**
2. Click **Add endpoint**
3. Enter URL: `https://[project-ref].supabase.co/functions/v1/stripe-webhook`
4. Select events to listen to:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Copy the webhook signing secret and set it as `STRIPE_WEBHOOK_SECRET`

## Testing

Test the webhook locally:

```bash
# Start Supabase locally
supabase start

# Serve the function
supabase functions serve stripe-webhook

# Use Stripe CLI to forward webhooks
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
```

## Flow Diagram

```
Stripe Event
    ↓
Webhook Signature Verification
    ↓
Identify Event Type
    ↓
Get/Create Person from Stripe Customer
    ├─ Check identity_link for existing mapping
    └─ Create person and identity_link if new
    ↓
Update subscription table
    └─ Upsert subscription record
    ↓
Create event record
    └─ Log to unified event table
```

## Error Handling

- Invalid signatures return 401
- Missing person mapping logs warning but doesn't fail
- Database errors are logged and return 500

## Related Features

- **GDP-008**: Subscription Snapshot - Uses data from this webhook
- **GDP-009**: PostHog Identity Stitching - Links PostHog distinct_id to person_id
- **GDP-010**: Meta Pixel + CAPI Dedup - Sends subscription events to Meta
