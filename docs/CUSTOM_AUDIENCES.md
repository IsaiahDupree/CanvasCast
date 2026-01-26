# Custom Audiences Setup (META-007)

## Overview

CanvasCast automatically segments users into custom audiences based on their behavior and spend patterns. These segments are integrated with Meta Pixel for improved ad targeting and retargeting in Facebook Ads Manager.

## Audience Segments

The following audience segments are automatically tracked:

| Segment | Description | Criteria |
|---------|-------------|----------|
| `FREE_TRIAL_USER` | Users on free trial | Has trial credits, hasn't purchased |
| `PAYING_CUSTOMER` | Users who made a purchase | Has made at least one purchase |
| `HIGH_VALUE_CUSTOMER` | High-lifetime-value customers | Total spend > $100 |
| `ACTIVATED_USER` | Users who generated videos | Generated at least 1 video |
| `CHURNED_USER` | Inactive users | No activity for 30+ days |
| `POWER_USER` | Highly engaged users | 20+ videos, $100+ spend, has subscription |
| `SUBSCRIBER` | Active subscribers | Has active subscription |

## Automatic Segmentation

User segments are automatically calculated and sent to Meta Pixel when you identify a user:

```typescript
import { identifyUser } from '@/lib/analytics';

// Identify user with behavior data
identifyUser('user_123', {
  email: 'user@example.com',
  plan: 'creator',
  totalSpent: 15000,        // in cents ($150)
  videosGenerated: 30,
  hasPurchased: true,
  hasSubscription: true,
  daysSinceLastActive: 2,
});

// Segments automatically calculated:
// - PAYING_CUSTOMER (hasPurchased = true)
// - HIGH_VALUE_CUSTOMER (totalSpent >= $100)
// - ACTIVATED_USER (videosGenerated >= 1)
// - POWER_USER (20+ videos, $100+ spend, subscription)
// - SUBSCRIBER (hasSubscription = true)
```

## Manual Segmentation

You can also manually calculate and track segments:

```typescript
import { getUserSegments, trackUserSegment, AudienceSegment } from '@/lib/analytics';

// Calculate segments for a user
const segments = getUserSegments({
  hasTrialCredits: false,
  hasPurchased: true,
  totalSpent: 15000,
  videosGenerated: 30,
  hasSubscription: true,
});

console.log(segments);
// [
//   'paying_customer',
//   'high_value_customer',
//   'activated_user',
//   'power_user',
//   'subscriber'
// ]

// Track when a user moves to a new segment
trackUserSegment('user_123', AudienceSegment.HIGH_VALUE_CUSTOMER, {
  totalSpent: 15000,
  videosGenerated: 30,
});
```

## Using Segments in Meta Ads Manager

Once segments are tracked, you can create custom audiences in Meta Ads Manager:

1. Go to **Meta Ads Manager** → **Audiences**
2. Click **Create Audience** → **Custom Audience**
3. Select **Website** as the source
4. Choose **Events** and filter by:
   - Event name: `UserSegmentUpdate`
   - Parameter: `segment`
   - Value: One of the segment values (e.g., `high_value_customer`)

### Recommended Audience Strategies

**Retargeting Active Users:**
- Target: `ACTIVATED_USER` segment
- Use case: Users who generated videos but haven't purchased
- Goal: Convert free trial to paid

**High-Value Lookalikes:**
- Source: `HIGH_VALUE_CUSTOMER` segment
- Use case: Create lookalike audiences for acquisition
- Goal: Find similar high-value prospects

**Win-Back Campaigns:**
- Target: `CHURNED_USER` segment
- Use case: Re-engage inactive users
- Goal: Retention and reactivation

**Upsell to Power Users:**
- Target: `POWER_USER` segment
- Use case: Premium feature announcements
- Goal: Increase engagement and loyalty

## Segment Update Triggers

Segments are recalculated and updated in these scenarios:

1. **User Login:** When `identifyUser()` is called
2. **Purchase Completion:** After credits or subscription purchase
3. **Video Generation:** After video generation completes
4. **Subscription Changes:** On subscribe/cancel events

## Advanced: Custom Segment Logic

To add custom segmentation logic, modify the `getUserSegments()` function:

```typescript
// apps/web/src/lib/custom-audiences.ts

export function getUserSegments(userData: UserAudienceData): AudienceSegment[] {
  const segments: AudienceSegment[] = [];

  // Add your custom logic
  if ((userData.videosGenerated ?? 0) >= 50) {
    segments.push('SUPER_USER' as AudienceSegment);
  }

  return segments;
}
```

## Testing

The implementation includes comprehensive tests:

```bash
pnpm test apps/web/__tests__/custom-audiences.test.ts
```

Tests cover:
- Segment identification logic
- Meta Pixel integration
- Value-based classification
- Engagement tracking
- Property normalization

## Privacy & Compliance

- User emails are **automatically hashed** using SHA-256 before sending to Meta
- Segments respect cookie consent preferences
- No PII is sent in segment tracking events (except hashed email)

## Environment Variables

Make sure your Meta Pixel ID is configured:

```bash
# .env.local
NEXT_PUBLIC_META_PIXEL_ID=your_pixel_id_here
```

## Next Steps

- **META-008**: Conversion optimization based on audience segments
- **GDP-011**: Person features computation for cross-channel tracking

## References

- [Meta Custom Audiences](https://www.facebook.com/business/help/744354708981227)
- [Meta Pixel Events](https://developers.facebook.com/docs/meta-pixel/implementation/events)
- [Advanced Matching](https://developers.facebook.com/docs/meta-pixel/advanced/advanced-matching)
