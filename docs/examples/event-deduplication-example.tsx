/**
 * Event Deduplication Example (META-005)
 *
 * This example shows how to use event deduplication to track
 * conversion events to both Meta Pixel (browser) and Meta CAPI (server)
 * while ensuring they're only counted once in Facebook Ads Manager.
 */

'use client';

import { useState } from 'react';
import { trackDualWithCAPI, trackAndPrepareServerEvent } from '@/lib/event-coordination';
import { trackEventDual } from '@/lib/analytics';

/**
 * EXAMPLE 1: Simple Dual Tracking
 *
 * Use trackDualWithCAPI for events that need both client and server tracking
 * This automatically handles event ID generation and coordination
 */
export function SimplePurchaseButton() {
  const [loading, setLoading] = useState(false);

  const handlePurchase = async () => {
    setLoading(true);

    try {
      // Track to both Pixel AND CAPI with one call
      const result = await trackDualWithCAPI(
        'purchase_completed',
        // Client properties (for PostHog + Pixel)
        {
          amount: 2999, // in cents
          credits: 100,
          product_type: 'credits',
        },
        // Server user data (for CAPI)
        {
          email: 'user@example.com', // Get from user context
        }
      );

      if (result.success) {
        console.log('Event tracked successfully with ID:', result.eventId);
        alert('Purchase tracked!');
      } else {
        console.error('Failed to track event:', result.error);
      }
    } catch (error) {
      console.error('Purchase tracking error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handlePurchase} disabled={loading}>
      {loading ? 'Processing...' : 'Buy 100 Credits - $29.99'}
    </button>
  );
}

/**
 * EXAMPLE 2: Stripe Checkout with Event ID
 *
 * Pass event ID through Stripe metadata so the webhook can use it
 * This ensures the same event ID is used from checkout → webhook → CAPI
 */
export function StripeCheckoutButton() {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);

    try {
      // 1. Track checkout started and prepare server payload
      const { eventId, serverPayload } = trackAndPrepareServerEvent(
        'checkout_started',
        {
          amount: 2999,
          credits: 100,
        },
        {
          email: 'user@example.com',
        }
      );

      // 2. Create Stripe checkout with event ID in metadata
      const response = await fetch('/api/v1/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 2999,
          credits: 100,
          // IMPORTANT: Pass event ID to server
          meta_event_id: eventId,
        }),
      });

      const { checkoutUrl } = await response.json();

      // 3. Redirect to Stripe checkout
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Checkout error:', error);
      setLoading(false);
    }
  };

  return (
    <button onClick={handleCheckout} disabled={loading}>
      {loading ? 'Creating checkout...' : 'Buy Credits'}
    </button>
  );
}

/**
 * EXAMPLE 3: Client-Only Tracking
 *
 * For non-critical events that don't need server-side reliability
 */
export function VideoPlayerWithTracking() {
  const handleVideoDownload = () => {
    // Client-only tracking (Meta Pixel + PostHog)
    trackEventDual('video_downloaded', {
      video_id: 'video_123',
      project_id: 'project_456',
      duration: 30,
    });

    // Proceed with download
    window.location.href = '/api/videos/video_123/download';
  };

  return (
    <div>
      <video controls src="/videos/video_123.mp4" />
      <button onClick={handleVideoDownload}>
        Download Video
      </button>
    </div>
  );
}

/**
 * EXAMPLE 4: Server-Side Webhook Handler
 *
 * How to handle the event in your webhook to complete the deduplication cycle
 */

// File: apps/api/src/webhooks/stripe.ts
/*
import { extractOrGenerateEventId } from '@/lib/event-coordination';
import { trackServerSideEvent } from '../lib/meta-capi';

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
) {
  const { customer_email, amount_total, metadata } = session;

  // Extract the event ID from metadata (from client-side)
  const eventId = extractOrGenerateEventId(metadata);

  // Track to Meta CAPI with the SAME event ID
  await trackServerSideEvent({
    eventName: 'Purchase',
    eventId: eventId, // Same ID as client-side
    eventTime: Math.floor(Date.now() / 1000),
    userData: {
      email: customer_email,
    },
    customData: {
      value: amount_total / 100,
      currency: 'USD',
      numItems: metadata.credits,
    },
    actionSource: 'website',
  });

  // Grant credits to user...
  await grantCredits(metadata.user_id, metadata.credits);

  console.log('Purchase tracked with event ID:', eventId);
}
*/

/**
 * EXAMPLE 5: Subscription Event (Server-Only)
 *
 * Some events only happen server-side (e.g., subscription renewals)
 */

// File: apps/api/src/webhooks/stripe.ts
/*
import { generateEventId } from '@/lib/event-coordination';
import { trackServerSideEvent } from '../lib/meta-capi';

export async function handleSubscriptionRenewal(
  subscription: Stripe.Subscription
) {
  // Generate new event ID for server-only events
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
      predicted_ltv: (subscription.plan.amount / 100) * 6,
    },
    actionSource: 'website',
  });

  // Grant monthly credits...
  await grantMonthlyCredits(subscription);

  console.log('Renewal tracked with event ID:', eventId);
}
*/

/**
 * API ENDPOINT EXAMPLE
 *
 * Create a purchase endpoint that accepts the event ID from the client
 */

// File: apps/api/src/routes/credits.ts
/*
import { addEventIdToMetadata } from '@/lib/event-coordination';

router.post('/api/v1/credits/purchase', async (req, res) => {
  const { amount, credits, meta_event_id } = req.body;

  // Create Stripe checkout session
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: `${credits} Video Credits`,
        },
        unit_amount: amount,
      },
      quantity: 1,
    }],
    success_url: `${process.env.APP_URL}/app/credits?success=true`,
    cancel_url: `${process.env.APP_URL}/app/credits?canceled=true`,
    // IMPORTANT: Include event ID in metadata
    metadata: addEventIdToMetadata(
      {
        user_id: req.user.id,
        credits: credits.toString(),
      },
      meta_event_id
    ),
  });

  res.json({ checkoutUrl: session.url });
});
*/

/**
 * KEY TAKEAWAYS:
 *
 * 1. Use generateEventId() to create unique IDs
 * 2. Pass the same event ID to both client-side (Pixel) and server-side (CAPI)
 * 3. Include event IDs in API requests via body or Stripe metadata
 * 4. Extract event IDs in webhooks with extractOrGenerateEventId()
 * 5. Meta automatically deduplicates events with matching event IDs
 *
 * BENEFITS:
 *
 * - Accurate conversion tracking (no double-counting)
 * - Better ad campaign optimization
 * - Resilience against ad blockers (server-side backup)
 * - Improved attribution data quality
 */
