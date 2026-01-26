# Meta Pixel Integration (META-003)

## Overview

CanvasCast automatically tracks key conversion events to both PostHog and Meta Pixel for advertising optimization. This document explains how the integration works and how to use it.

## Standard Events Mapping

The following CanvasCast events are automatically mapped to Meta Pixel standard events:

| CanvasCast Event | Meta Standard Event | Parameters |
|------------------|---------------------|------------|
| `landing_view` | `PageView` | - |
| `demo_video_played` | `ViewContent` | `content_type: 'demo'` |
| `signup_completed` | `CompleteRegistration` | `content_name`, `status` |
| `video_generated` | `ViewContent` | `content_type: 'video'`, `content_ids` |
| `video_downloaded` | `AddToCart` | `content_type: 'video'` |
| `checkout_started` | `InitiateCheckout` | `value`, `currency` |
| `purchase_completed` | `Purchase` | `value`, `currency`, `num_items` |
| `subscription_started` | `Subscribe` | `value`, `currency`, `predicted_ltv` |
| `subscription_completed` | `Subscribe` | `value`, `currency`, `predicted_ltv` |

## Usage

### Basic Tracking

Use `trackEventDual()` to track events to both PostHog and Meta Pixel:

```typescript
import { trackEventDual } from '@/lib/analytics';

// Track landing page view
trackEventDual('landing_view', {
  referrer: document.referrer,
  utm_source: 'google',
  utm_campaign: 'summer_2024',
});

// Track video download
trackEventDual('video_downloaded', {
  video_id: 'video_123',
  project_id: 'project_456',
});
```

### Monetization Events

For checkout and purchase events, amounts should be in cents:

```typescript
// Track checkout started
trackEventDual('checkout_started', {
  product_type: 'credits',
  amount: 2999, // $29.99 in cents
  credits: 100,
});

// Track purchase completed
trackEventDual('purchase_completed', {
  product_type: 'credits',
  amount: 2999,
  credits: 100,
  transaction_id: 'txn_abc123',
});

// Track subscription
trackEventDual('subscription_started', {
  plan: 'creator',
  amount: 4900, // $49.00 in cents
  credits_per_month: 200,
});
```

The mapper automatically:
- Converts `amount` (cents) to `value` (dollars)
- Adds `currency: 'USD'`
- Calculates `predicted_ltv` for subscriptions (6-month retention)
- Maps `credits` to `num_items` for purchases

### In React Components

Use the tracking functions in event handlers or useEffect:

```typescript
'use client';

import { trackEventDual } from '@/lib/analytics';

export function VideoDownloadButton({ videoId }: { videoId: string }) {
  const handleDownload = async () => {
    // Track the download event
    trackEventDual('video_downloaded', {
      video_id: videoId,
      timestamp: new Date().toISOString(),
    });

    // Proceed with download
    const url = await getDownloadUrl(videoId);
    window.location.href = url;
  };

  return (
    <button onClick={handleDownload}>
      Download Video
    </button>
  );
}
```

### Server-Side API Tracking

For server-side events (e.g., in API routes), use the standard tracking:

```typescript
// In API route handler
import { trackEventDual } from '@/lib/analytics';

export async function POST(request: Request) {
  const { projectId, userId } = await request.json();

  // Create the project
  const project = await createProject(projectId, userId);

  // Track the event
  trackEventDual('project_created', {
    project_id: project.id,
    user_id: userId,
  });

  return Response.json({ success: true });
}
```

## Event Deduplication

The integration automatically handles event deduplication between client-side (Pixel) and server-side (CAPI) tracking:

1. Generates a unique `event_id` for each tracked event
2. Includes the `event_id` in both PostHog properties (`meta_event_id`) and Meta Pixel events
3. Meta's deduplication logic uses the `eventID` to prevent double-counting

Example of what happens internally:

```typescript
// User clicks "Purchase"
trackEventDual('purchase_completed', { amount: 2999 });

// Result:
// 1. PostHog receives: { event: 'purchase_completed', meta_event_id: 'evt_1234567890_abc123' }
// 2. Meta Pixel receives: Purchase event with eventID: 'evt_1234567890_abc123'
// 3. Future CAPI call (META-004) will use the same event_id for deduplication
```

## Testing

The integration includes comprehensive tests in `apps/web/__tests__/meta-pixel-mapping.test.ts`:

```bash
pnpm test apps/web/__tests__/meta-pixel-mapping.test.ts
```

## Environment Variables

Make sure to set your Meta Pixel ID:

```bash
# .env.local
NEXT_PUBLIC_META_PIXEL_ID=your_pixel_id_here
```

## Cookie Consent

The Meta Pixel respects user cookie preferences. If a user has not consented to analytics cookies, the pixel will not load.

## Direct Meta Pixel Usage

If you need to track events directly to Meta Pixel without PostHog:

```typescript
import { trackMetaEvent, META_EVENTS } from '@/lib/meta-pixel';

// Track a standard event
trackMetaEvent(META_EVENTS.PAGE_VIEW, {});

// Track with custom properties
trackMetaEvent(META_EVENTS.PURCHASE, {
  value: 29.99,
  currency: 'USD',
});

// Track with event ID for deduplication
const eventId = 'evt_1234567890_abc123';
trackMetaEvent(META_EVENTS.PURCHASE, { value: 29.99, currency: 'USD' }, eventId);
```

## Next Steps

- **META-004**: Implement CAPI (Conversions API) for server-side event tracking
- **META-005**: Add event deduplication between Pixel and CAPI
- **META-006**: Implement PII hashing for user data

## References

- [Meta Pixel Documentation](https://developers.facebook.com/docs/meta-pixel)
- [Standard Events](https://developers.facebook.com/docs/meta-pixel/reference)
- [Event Deduplication](https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events)
