# Meta Conversions API (CAPI) Implementation

## Feature: META-004 - CAPI Server-Side Events

### Overview

This document describes the implementation of Meta Conversions API (CAPI) for CanvasCast, enabling server-side event tracking to Facebook/Meta for improved ad campaign optimization and measurement.

### What is Meta CAPI?

Meta Conversions API allows you to send web events directly from your server to Facebook, bypassing browser-based tracking limitations such as:
- Ad blockers
- Browser privacy settings
- Cookie restrictions
- iOS 14.5+ tracking limitations

### Implementation Components

#### 1. Meta CAPI Client Library

**Location:** `apps/api/src/lib/meta-capi.ts`

Key functions:
- `initMetaCAPI(accessToken, pixelId)` - Initialize the CAPI client
- `trackServerSideEvent(eventData)` - Track a single server-side event
- `trackServerSideEventsBatch(events)` - Track multiple events in batch
- `hashUserData(data)` - Hash PII data (email, phone) with SHA256
- `extractMetaCookies(cookieHeader)` - Extract Facebook cookies from requests

#### 2. API Endpoint

**Location:** `apps/api/src/routes/meta-capi.ts`

**Endpoint:** `POST /api/meta-capi`

**Request Body:**
```json
{
  "eventName": "Purchase",
  "eventId": "evt_123456",
  "eventTime": 1706234567,
  "eventSourceUrl": "https://example.com/checkout",
  "userData": {
    "email": "user@example.com",
    "phone": "+1234567890",
    "clientIpAddress": "192.0.2.1",
    "clientUserAgent": "Mozilla/5.0...",
    "fbp": "fb.1.123456.789",
    "fbc": "fb.1.123456.abc"
  },
  "customData": {
    "value": 29.99,
    "currency": "USD",
    "contentIds": ["plan_pro"],
    "numItems": 100
  },
  "actionSource": "website"
}
```

**Response:**
```json
{
  "success": true,
  "eventsReceived": 1,
  "messages": []
}
```

#### 3. Health Check

**Endpoint:** `GET /api/meta-capi/health`

Returns the configuration status of Meta CAPI.

### Environment Variables

Add these to `apps/api/.env`:

```bash
# Meta Conversions API (CAPI)
META_PIXEL_ID=123456789
META_ACCESS_TOKEN=EAAxxxx...
```

**How to get credentials:**

1. Go to [Facebook Events Manager](https://business.facebook.com/events_manager)
2. Select your Pixel
3. Go to Settings > Conversions API
4. Generate an access token
5. Copy your Pixel ID and Access Token

### Event Deduplication with Client-Side Pixel

To prevent duplicate events from being counted when you send the same event from both browser (Pixel) and server (CAPI), use the same `eventID` for both:

**Client-side (Browser):**
```javascript
import { trackMetaEvent } from '@/lib/meta-pixel';

const eventId = 'evt_123456';
trackMetaEvent('Purchase', { value: 29.99, currency: 'USD' }, eventId);
```

**Server-side (API):**
```javascript
await fetch('/api/meta-capi', {
  method: 'POST',
  body: JSON.stringify({
    eventName: 'Purchase',
    eventId: 'evt_123456', // Same eventId
    userData: { email: 'user@example.com' },
    customData: { value: 29.99, currency: 'USD' },
    actionSource: 'website'
  })
});
```

Meta will deduplicate these events automatically if they have the same `eventId`.

### Privacy and PII Handling

All personally identifiable information (PII) is automatically hashed before being sent to Meta:

- **Email addresses**: Normalized (lowercase, trimmed) and SHA256 hashed
- **Phone numbers**: Normalized and SHA256 hashed
- **IP addresses**: Sent unhashed (Meta requires raw IP for attribution)
- **User agent**: Sent unhashed (Meta requires raw user agent)

### Standard Events Mapping

| CanvasCast Event | Meta Standard Event | Custom Data |
|------------------|---------------------|-------------|
| `signup_completed` | `CompleteRegistration` | `content_name: 'signup'` |
| `video_generated` | `ViewContent` | `content_type: 'video'` |
| `checkout_started` | `InitiateCheckout` | `value`, `currency` |
| `purchase_completed` | `Purchase` | `value`, `currency`, `num_items` |
| `subscription_started` | `Subscribe` | `value`, `currency`, `predicted_ltv` |

### Testing

Tests are located in `apps/api/src/__tests__/meta-capi.test.ts`.

Run tests:
```bash
pnpm vitest run apps/api/src/__tests__/meta-capi.test.ts
```

Test coverage:
- ✅ SHA256 hashing of PII data
- ✅ Email normalization before hashing
- ✅ Cookie extraction from headers
- ✅ Event data validation
- ✅ Initialization without errors

### Integration Example

Here's how to track a purchase event from your checkout flow:

```typescript
import { trackServerSideEvent } from './lib/meta-capi';

async function handlePurchaseComplete(order: Order, req: Request) {
  // Generate unique event ID for deduplication
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Track on server-side
  await trackServerSideEvent({
    eventName: 'Purchase',
    eventId,
    eventTime: Math.floor(Date.now() / 1000),
    eventSourceUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
    userData: {
      email: order.customerEmail,
      clientIpAddress: req.ip,
      clientUserAgent: req.get('user-agent'),
    },
    customData: {
      value: order.total / 100, // Convert cents to dollars
      currency: 'USD',
      contentIds: [order.planId],
      numItems: order.credits,
    },
    actionSource: 'website',
  });
}
```

### Troubleshooting

**Issue: Events not showing up in Meta Events Manager**

1. Check that `META_PIXEL_ID` and `META_ACCESS_TOKEN` are set correctly
2. Verify the access token has permission to send events
3. Check the API logs for error messages
4. Use the Test Events tool in Facebook Events Manager to debug

**Issue: Events are duplicated**

1. Ensure you're using the same `eventId` for client and server events
2. Check that the `eventId` is unique per event occurrence
3. Verify the `eventTime` is within 7 days of current time

**Issue: Attribution not working**

1. Make sure you're sending `clientIpAddress` and `clientUserAgent`
2. Include Facebook cookies (`fbp`, `fbc`) if available
3. Verify `eventSourceUrl` matches your domain

### Security Notes

- Never expose `META_ACCESS_TOKEN` to the client
- Always hash PII data before sending to Meta
- Use HTTPS for all API requests
- Implement rate limiting on the `/api/meta-capi` endpoint
- Validate all input data before sending to Meta

### Related Features

- **META-001**: Meta Pixel Installation (client-side tracking)
- **META-003**: Standard Events Mapping
- **META-005**: Event Deduplication (will ensure same eventID used)
- **META-006**: User Data Hashing (PII protection)

### Resources

- [Meta Conversions API Documentation](https://developers.facebook.com/docs/marketing-api/conversions-api)
- [Facebook Business SDK for Node.js](https://github.com/facebook/facebook-nodejs-business-sdk)
- [Event Deduplication Guide](https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events)
