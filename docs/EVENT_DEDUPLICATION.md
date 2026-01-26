# Event Deduplication (META-005)

## Overview

Event deduplication ensures that when the same conversion event is tracked from both the browser (Meta Pixel) and the server (Meta Conversions API), it is only counted once in Facebook Ads Manager. This prevents inflated conversion numbers and improves ad campaign accuracy.

## How It Works

### 1. Event ID Generation

Every tracked event gets a unique event ID:

```typescript
import { generateEventId } from '@/lib/meta-pixel-mapper';

const eventId = generateEventId();
// Example: "evt_1706234567890_abc1234"
```

The event ID format:
- Prefix: `evt_`
- Timestamp: Unix timestamp in milliseconds
- Random suffix: 7-character alphanumeric string
- Total length: < 40 characters (Meta's requirement)

### 2. Client-Side Tracking (Meta Pixel)

When tracking events from the browser, the event ID is automatically included:

```typescript
import { trackEventDual } from '@/lib/analytics';

// Track a purchase event
trackEventDual('purchase_completed', {
  amount: 2999, // in cents
  credits: 100,
  transaction_id: 'txn_abc123'
});
```

**What happens:**
1. Generates a unique event ID: `evt_1706234567890_abc1234`
2. Tracks to PostHog with `meta_event_id` property
3. Tracks to Meta Pixel with `eventID` parameter

**Meta Pixel call:**
```javascript
fbq('track', 'Purchase', {
  value: 29.99,
  currency: 'USD',
  num_items: 100
}, {
  eventID: 'evt_1706234567890_abc1234'
});
```

### 3. Server-Side Tracking (Meta CAPI)

For critical conversion events, you should also send them server-side for reliability:

```typescript
// In your API route or webhook handler
const eventId = 'evt_1706234567890_abc1234'; // Same ID from client

await fetch('/api/meta-capi', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    eventName: 'Purchase',
    eventId: eventId, // SAME event ID as client-side
    eventTime: Math.floor(Date.now() / 1000),
    userData: {
      email: user.email,
      clientIpAddress: req.ip,
      clientUserAgent: req.headers['user-agent'],
    },
    customData: {
      value: 29.99,
      currency: 'USD',
      numItems: 100,
    },
    actionSource: 'website'
  })
});
```

### 4. Meta's Deduplication

Meta automatically deduplicates events with the same `eventID`:
- If both Pixel and CAPI send an event with ID `evt_1706234567890_abc1234`
- Meta counts it as **ONE** conversion, not two
- The server-side data is prioritized for attribution

## Implementation Patterns

### Pattern 1: Client-Only Tracking

For non-critical events that don't require server-side reliability:

```typescript
import { trackEventDual } from '@/lib/analytics';

// Track landing page view (client-only is fine)
trackEventDual('landing_view', {
  referrer: document.referrer,
  utm_source: searchParams.get('utm_source'),
});
```

### Pattern 2: Dual Tracking (Client + Server)

For critical conversion events that need both Pixel and CAPI:

**Step 1: Client-side (in component)**

```typescript
'use client';

import { trackEventDual } from '@/lib/analytics';

export function CheckoutButton() {
  const handleCheckout = async () => {
    // Track checkout started
    trackEventDual('checkout_started', {
      product_type: 'credits',
      amount: 2999,
      credits: 100,
    });

    // Redirect to Stripe checkout
    const response = await fetch('/api/v1/credits/purchase', {
      method: 'POST',
      body: JSON.stringify({ amount: 2999, credits: 100 })
    });

    const { checkoutUrl } = await response.json();
    window.location.href = checkoutUrl;
  };

  return <button onClick={handleCheckout}>Buy Credits</button>;
}
```

**Step 2: Server-side (in Stripe webhook)**

```typescript
// apps/api/src/webhooks/stripe.ts

import { trackServerSideEvent } from '../lib/meta-capi';

export async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const { customer_email, amount_total, metadata } = session;

  // Extract event ID from session metadata (if client sent it)
  // OR generate a new one for server-only events
  const eventId = metadata.meta_event_id || generateEventId();

  // Track to Meta CAPI
  await trackServerSideEvent({
    eventName: 'Purchase',
    eventId: eventId, // Use same ID if available
    eventTime: Math.floor(Date.now() / 1000),
    userData: {
      email: customer_email,
    },
    customData: {
      value: amount_total / 100, // Convert cents to dollars
      currency: 'USD',
      numItems: metadata.credits,
    },
    actionSource: 'website'
  });

  // Grant credits to user...
}
```

### Pattern 3: Server-Only Tracking

For events that only happen server-side (subscriptions, renewals, etc.):

```typescript
import { generateEventId } from '@/lib/meta-pixel-mapper';
import { trackServerSideEvent } from '../lib/meta-capi';

// Subscription renewal (server-only)
export async function handleSubscriptionRenewal(subscription: Stripe.Subscription) {
  const eventId = generateEventId();

  await trackServerSideEvent({
    eventName: 'Subscribe',
    eventId: eventId,
    eventTime: Math.floor(Date.now() / 1000),
    userData: {
      email: subscription.customer_email,
    },
    customData: {
      value: subscription.plan.amount / 100,
      currency: 'USD',
      predicted_ltv: (subscription.plan.amount / 100) * 6, // 6 month LTV
    },
    actionSource: 'website'
  });
}
```

## Event ID Lifecycle

```
User Action (e.g., clicks "Buy")
         ↓
[1] Client generates event ID
    → evt_1706234567890_abc1234
         ↓
[2] Client tracks to Meta Pixel
    → fbq('track', 'Purchase', {...}, { eventID: 'evt_...' })
         ↓
[3] Client tracks to PostHog
    → posthog.capture('purchase_completed', { meta_event_id: 'evt_...' })
         ↓
[4] Client sends event ID to server (optional)
    → POST /api/meta-capi with eventId
         ↓
[5] Server tracks to Meta CAPI
    → EventRequest with same eventId
         ↓
[6] Meta deduplicates
    → Only counts as 1 conversion
```

## Passing Event IDs from Client to Server

### Method 1: Include in Stripe Metadata

```typescript
// Client-side
const eventId = generateEventId();

// Track to Pixel
trackEventDual('checkout_started', { amount: 2999 });

// Send to Stripe with metadata
const response = await fetch('/api/v1/credits/purchase', {
  method: 'POST',
  body: JSON.stringify({
    amount: 2999,
    credits: 100,
    meta_event_id: eventId // Pass to server
  })
});

// In your API endpoint, add to Stripe metadata
const session = await stripe.checkout.sessions.create({
  // ...other params
  metadata: {
    user_id: userId,
    credits: 100,
    meta_event_id: eventId // Store for webhook
  }
});
```

### Method 2: Direct API Call

```typescript
// Client-side
import { generateEventId } from '@/lib/meta-pixel-mapper';

const eventId = generateEventId();

// Track to Pixel (client-side)
trackEventDual('purchase_completed', { amount: 2999 });

// Also send to CAPI endpoint (server-side)
await fetch('/api/meta-capi', {
  method: 'POST',
  body: JSON.stringify({
    eventName: 'Purchase',
    eventId: eventId, // Same ID
    userData: {
      email: user.email,
    },
    customData: {
      value: 29.99,
      currency: 'USD',
    },
    actionSource: 'website'
  })
});
```

## Testing Deduplication

### Manual Test in Events Manager

1. Navigate to Facebook Events Manager
2. Go to your Pixel → Test Events
3. Trigger an event that fires both Pixel and CAPI
4. In Test Events, you should see:
   - Event name: `Purchase`
   - Source: `Browser and Server` (deduped)
   - Event ID: `evt_1706234567890_abc1234`

### Automated Tests

Run the deduplication test suite:

```bash
pnpm test apps/web/__tests__/event-deduplication.test.ts
```

Tests cover:
- Event ID generation and format
- Client-side tracking with event IDs
- Server-side event ID usage
- Event ID consistency across client/server
- Deduplication edge cases

## Best Practices

### ✅ DO

1. **Always generate event IDs for conversion events**
   - Purchases, subscriptions, sign-ups
   - Any event you track to both Pixel and CAPI

2. **Use the same event ID for the same event occurrence**
   - If a user completes a purchase, use one event ID for both Pixel and CAPI

3. **Include event IDs in server requests**
   - Pass via API body, Stripe metadata, or session storage

4. **Track critical events to both Pixel and CAPI**
   - Provides redundancy if ad blockers block the Pixel
   - Server-side data is more reliable for attribution

### ❌ DON'T

1. **Don't reuse event IDs for different events**
   - Each unique user action should have a unique event ID
   - Two different purchases should have two different event IDs

2. **Don't skip event IDs on conversion events**
   - Without event IDs, Meta can't deduplicate
   - Results in inflated conversion counts

3. **Don't send events with different event IDs from client and server**
   - Meta will count them as separate conversions
   - Defeats the purpose of deduplication

## Troubleshooting

### Issue: Events are counted twice in Ads Manager

**Cause:** Client and server are sending different event IDs

**Solution:**
1. Check that both Pixel and CAPI calls use the same `eventId`
2. Verify the event ID is being passed from client to server
3. Use Test Events in Events Manager to inspect event IDs

### Issue: Events are not showing up in Ads Manager

**Cause:** Event ID format might be invalid

**Solution:**
1. Verify event ID matches format: `evt_{timestamp}_{random}`
2. Ensure event ID is < 40 characters
3. Check that event ID contains only alphanumeric, hyphens, underscores

### Issue: Server-side events not deduplicating

**Cause:** Event time difference too large between client and server

**Solution:**
1. Ensure `eventTime` is within 7 days of current time
2. Use consistent timestamps (Unix seconds)
3. Send events close together in time

## Reference

- [Meta Event Deduplication Documentation](https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events)
- [Meta Standard Events](https://developers.facebook.com/docs/meta-pixel/reference)
- PRD: `docs/prds/PRD_META_PIXEL_TRACKING.md`

## Related Features

- **META-001**: Meta Pixel Installation
- **META-003**: Standard Events Mapping
- **META-004**: CAPI Server-Side Events
- **META-006**: User Data Hashing (PII)
