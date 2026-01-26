# Conversion Optimization (META-008)

## Overview

CanvasCast implements Meta Pixel conversion optimization features to maximize the value and efficiency of Facebook ad campaigns. This includes predictive lifetime value (LTV) calculations, value-based bidding support, and conversion value helpers.

## Features

### 1. Predictive LTV Calculation

Calculate predicted customer lifetime value for subscriptions and purchases:

```typescript
import { calculatePredictedLTV } from '@/lib/conversion-optimization';

// Calculate 6-month LTV for a subscriber
const ltv = calculatePredictedLTV({
  currentMonthlyValue: 49.00,
  retentionMonths: 6,
  retentionRate: 0.8, // 80% retention
});

console.log(ltv); // 235.20 ($49 * 6 * 0.8)
```

### 2. Conversion Value Helpers

Automatically calculate conversion values for different event types:

```typescript
import { getConversionValue, ConversionEvent } from '@/lib/conversion-optimization';

// Purchase event
const purchaseValue = getConversionValue(ConversionEvent.PURCHASE, {
  amount: 2999, // cents
  credits: 100,
});
// Returns: { value: 29.99, currency: 'USD', numItems: 100 }

// Subscription event with predicted LTV
const subscriptionValue = getConversionValue(ConversionEvent.SUBSCRIPTION, {
  amount: 4900,
  plan: 'creator',
});
// Returns: { value: 49.00, currency: 'USD', predictedLtv: 294.00 }

// Video generation (engagement value)
const videoValue = getConversionValue(ConversionEvent.VIDEO_GENERATED, {
  projectId: 'proj_123',
});
// Returns: { value: 5.00, currency: 'USD', contentType: 'video' }
```

### 3. Campaign Optimization Parameters

Get recommended parameters for different campaign optimization goals:

```typescript
import { getOptimizationParams, OptimizationGoal } from '@/lib/conversion-optimization';

// Value-based optimization
const valueParams = getOptimizationParams(OptimizationGoal.VALUE);
// Returns: {
//   optimizationGoal: 'VALUE',
//   bidStrategy: 'LOWEST_COST_WITH_BID_CAP',
//   conversionWindow: 7,
//   attributionSetting: 'DEFAULT'
// }

// Conversion optimization
const conversionParams = getOptimizationParams(OptimizationGoal.CONVERSIONS, {
  conversionWindow: 28,
  attributionSetting: '7_DAY_CLICK_1_DAY_VIEW',
});
```

## Usage Examples

### Tracking Purchase with Value Optimization

```typescript
import { trackEventDual } from '@/lib/analytics';
import { getConversionValue, ConversionEvent } from '@/lib/conversion-optimization';

export async function handlePurchase(amount: number, credits: number) {
  // Get optimized conversion value
  const conversionValue = getConversionValue(ConversionEvent.PURCHASE, {
    amount,
    credits,
  });

  // Track to both PostHog and Meta Pixel with value
  trackEventDual('purchase_completed', {
    amount,
    credits,
    value: conversionValue.value,
    currency: conversionValue.currency,
    num_items: conversionValue.numItems,
  });
}
```

### Subscription with Predicted LTV

```typescript
import { trackEventDual } from '@/lib/analytics';
import { getConversionValue, ConversionEvent } from '@/lib/conversion-optimization';

export async function handleSubscription(plan: string, amount: number) {
  // Get subscription value with predicted LTV
  const conversionValue = getConversionValue(ConversionEvent.SUBSCRIPTION, {
    amount,
    plan,
  });

  // Track with predicted LTV for better optimization
  trackEventDual('subscription_started', {
    amount,
    plan,
    value: conversionValue.value,
    predicted_ltv: conversionValue.predictedLtv,
  });
}
```

### Video Engagement Tracking

```typescript
import { trackEventDual } from '@/lib/analytics';
import { getConversionValue, ConversionEvent } from '@/lib/conversion-optimization';

export function trackVideoDownload(videoId: string) {
  // Videos have an engagement value for optimization
  const conversionValue = getConversionValue(ConversionEvent.VIDEO_DOWNLOADED, {
    videoId,
  });

  trackEventDual('video_downloaded', {
    video_id: videoId,
    value: conversionValue.value,
    content_type: conversionValue.contentType,
  });
}
```

## Conversion Values

CanvasCast assigns the following conversion values:

| Event | Value | Notes |
|-------|-------|-------|
| `signup_completed` | $0 | No monetary value yet |
| `video_generated` | $5 | Fixed engagement value |
| `video_downloaded` | $2 | High intent indicator |
| `checkout_started` | Actual amount | From checkout data |
| `purchase_completed` | Actual amount | From purchase data |
| `subscription_started` | Monthly amount + Predicted LTV | 6-month retention default |

## Predictive LTV Formula

The LTV calculation uses the following formula:

```
Base LTV = (Monthly Value × Retention Months × Retention Rate) + One-time Value
Total LTV = Base LTV + (Upsell Probability × Expected Upsell Value)
```

### Example: Complex LTV Calculation

```typescript
const ltv = calculatePredictedLTV({
  currentMonthlyValue: 49.00,      // $49/month plan
  oneTimePurchaseValue: 29.00,     // Initial credit pack
  retentionMonths: 12,              // 1 year
  retentionRate: 0.75,              // 75% retention
  upsellProbability: 0.4,           // 40% upgrade chance
  expectedUpsellValue: 150.00,      // Expected upgrade value
});

// Calculation:
// Base: ($49 * 12 * 0.75) + $29 = $441 + $29 = $470
// Upsell: 0.4 * $150 = $60
// Total: $470 + $60 = $530
console.log(ltv); // 530.00
```

## Meta Campaign Setup

### Value-Based Bidding

Use value optimization parameters to set up campaigns that maximize customer value:

```typescript
const params = getOptimizationParams(OptimizationGoal.VALUE);

// In Meta Ads Manager:
// - Optimization Goal: VALUE
// - Bid Strategy: LOWEST_COST_WITH_BID_CAP
// - Conversion Window: 7 days
```

### Best Practices

1. **Track all conversion values**: Include value data in all purchase and subscription events
2. **Use predicted LTV**: Add `predicted_ltv` to subscription events for better optimization
3. **Set appropriate conversion windows**: Use 7 days for most conversions, 28 days for longer sales cycles
4. **Monitor performance**: Check Meta Ads Manager to see if value optimization is improving ROAS

## Integration with Existing Features

### Meta Pixel (META-003)

Conversion values are automatically sent to Meta Pixel when using `trackEventDual`:

```typescript
// This automatically includes conversion value
trackEventDual('purchase_completed', {
  amount: 2999,
  credits: 100,
});
```

### Custom Audiences (META-007)

Conversion values can be used to segment audiences:

- High-value customers (total spend > $100)
- Power users (high LTV, frequent purchases)
- Churned high-value customers (for win-back campaigns)

### Event Deduplication (META-005)

Conversion values are deduplicated along with events, ensuring accurate value tracking across client and server.

## Testing

Run conversion optimization tests:

```bash
pnpm test apps/web/__tests__/conversion-optimization.test.ts
```

All 26 tests should pass, covering:
- ✅ Predictive LTV calculations
- ✅ Conversion value helpers
- ✅ Campaign optimization parameters
- ✅ Edge cases and validation
- ✅ Integration with Meta Pixel

## Environment Variables

No additional environment variables required. Uses existing Meta Pixel configuration:

```bash
# .env.local
NEXT_PUBLIC_META_PIXEL_ID=your_pixel_id_here
```

## References

- [Meta Value Optimization](https://www.facebook.com/business/help/352188278976506)
- [Conversion Value Rules](https://www.facebook.com/business/help/414314272696836)
- [Value-Based Bidding](https://www.facebook.com/business/help/1695718164067060)
- [Predicted LTV](https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/custom-data)

## Next Steps

- **GDP-011**: Person features computation for enhanced targeting
- **Lookalike Audiences**: Create lookalikes based on high-LTV customers
- **Campaign Testing**: A/B test value optimization vs. conversion optimization
