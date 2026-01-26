# PRD: Meta Pixel & CAPI Integration for CanvasCast

**Status:** Active  
**Created:** 2026-01-25  
**Priority:** P1

## Overview

Implement Facebook Meta Pixel and Conversions API for CanvasCast to optimize video generation sign-ups and credit purchases.

## Standard Events Mapping

| CanvasCast Event | Meta Standard Event | Parameters |
|------------------|---------------------|------------|
| `landing_view` | `PageView` | - |
| `demo_video_played` | `ViewContent` | `content_type: 'demo'` |
| `signup_complete` | `CompleteRegistration` | `content_name`, `status` |
| `video_generated` | `ViewContent` | `content_type: 'video'`, `content_ids` |
| `video_downloaded` | `AddToCart` | `content_type: 'video'` |
| `checkout_started` | `InitiateCheckout` | `value`, `currency` |
| `credits_purchased` | `Purchase` | `value`, `currency`, `num_items` |
| `subscription_started` | `Subscribe` | `value`, `currency`, `predicted_ltv` |

## Implementation

### Pixel + CAPI Dual Tracking
```typescript
// Track on both client and server for redundancy
const trackPurchase = async (order: Order) => {
  const eventId = generateEventId();
  
  // Client-side
  fbq('track', 'Purchase', {
    value: order.amount,
    currency: 'USD',
    content_ids: [order.planId],
  }, { eventID: eventId });
  
  // Server-side CAPI
  await fetch('/api/meta-capi', {
    method: 'POST',
    body: JSON.stringify({
      event_name: 'Purchase',
      event_id: eventId,
      custom_data: { value: order.amount, currency: 'USD' },
    }),
  });
};
```

## Features

| ID | Name | Priority |
|----|------|----------|
| META-001 | Meta Pixel Installation | P1 |
| META-002 | PageView Tracking | P1 |
| META-003 | Standard Events Mapping | P1 |
| META-004 | CAPI Server-Side Events | P1 |
| META-005 | Event Deduplication | P1 |
| META-006 | User Data Hashing (PII) | P1 |
| META-007 | Custom Audiences Setup | P2 |
| META-008 | Conversion Optimization | P2 |
