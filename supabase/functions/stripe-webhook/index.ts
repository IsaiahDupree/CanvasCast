/**
 * GDP-007: Stripe Webhook Edge Function
 *
 * Receives webhooks from Stripe for subscription events:
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.paid
 * - invoice.payment_failed
 *
 * Maps stripe_customer_id to person_id via identity_link and creates/updates
 * subscription records in the Growth Data Plane.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Initialize Stripe client
const stripe = new Stripe(STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get Stripe signature header
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'Missing Stripe signature' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Read raw body for signature verification
    const body = await req.text();

    // Verify Stripe webhook signature
    let event: Stripe.Event;
    if (STRIPE_WEBHOOK_SECRET) {
      try {
        event = stripe.webhooks.constructEvent(
          body,
          signature,
          STRIPE_WEBHOOK_SECRET
        );
      } catch (err) {
        console.error('Stripe signature verification failed:', err);
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    } else {
      // If no secret configured, parse the body directly (not recommended for production)
      event = JSON.parse(body);
    }

    console.log('Received Stripe webhook:', event.type, event.id);

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Handle different event types
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(supabase, event);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(supabase, event);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(supabase, event);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(supabase, event);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(supabase, event);
        break;
      default:
        console.log('Unhandled event type:', event.type);
    }

    return new Response(JSON.stringify({ success: true, received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing Stripe webhook:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Helper function to get or create person from Stripe customer
 */
async function getOrCreatePersonFromCustomer(
  supabase: any,
  customerId: string,
  customer?: Stripe.Customer
): Promise<string | null> {
  // First, check if identity_link exists for this Stripe customer
  const { data: identityLink, error: linkError } = await supabase
    .from('identity_link')
    .select('person_id')
    .eq('source', 'stripe')
    .eq('external_id', customerId)
    .maybeSingle();

  if (!linkError && identityLink) {
    return identityLink.person_id;
  }

  // If customer object provided and has email, try to find or create person
  if (customer?.email) {
    // Try to find existing person by email
    const { data: existingPerson, error: personError } = await supabase
      .from('person')
      .select('id')
      .eq('email', customer.email)
      .maybeSingle();

    let personId: string;

    if (!personError && existingPerson) {
      personId = existingPerson.id;
    } else {
      // Create new person
      const { data: newPerson, error: createError } = await supabase
        .from('person')
        .insert({
          email: customer.email,
          first_name: customer.name?.split(' ')[0] || null,
          last_name: customer.name?.split(' ').slice(1).join(' ') || null,
          phone: customer.phone || null,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating person:', createError);
        return null;
      }

      personId = newPerson.id;
    }

    // Create identity link
    await supabase.from('identity_link').insert({
      person_id: personId,
      source: 'stripe',
      external_id: customerId,
      metadata: {
        customer_email: customer.email,
        customer_name: customer.name,
      },
    });

    return personId;
  }

  console.warn('Could not find or create person for customer:', customerId);
  return null;
}

/**
 * Handle customer.subscription.created event
 */
async function handleSubscriptionCreated(supabase: any, event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;

  // Get customer to access email
  const customer = await stripe.customers.retrieve(
    subscription.customer as string
  );

  const personId = await getOrCreatePersonFromCustomer(
    supabase,
    subscription.customer as string,
    customer as Stripe.Customer
  );

  if (!personId) {
    console.warn('Could not determine person_id for subscription:', subscription.id);
    return;
  }

  // Extract plan details
  const planName = subscription.items.data[0]?.price.nickname || 'Unknown';
  const planId = subscription.items.data[0]?.price.id || null;
  const mrr =
    subscription.items.data[0]?.price.unit_amount
      ? subscription.items.data[0].price.unit_amount / 100
      : 0;

  // Create subscription record
  const { error: subError } = await supabase.from('subscription').upsert(
    {
      stripe_subscription_id: subscription.id,
      person_id: personId,
      status: subscription.status,
      plan_name: planName,
      plan_id: planId,
      mrr: mrr,
      current_period_start: new Date(
        subscription.current_period_start * 1000
      ).toISOString(),
      current_period_end: new Date(
        subscription.current_period_end * 1000
      ).toISOString(),
    },
    { onConflict: 'stripe_subscription_id' }
  );

  if (subError) {
    console.error('Error creating subscription:', subError);
    throw subError;
  }

  // Create event in unified events table
  await supabase.from('event').insert({
    person_id: personId,
    event_name: 'subscription_created',
    event_source: 'stripe',
    properties: {
      subscription_id: subscription.id,
      plan: planName,
      mrr: mrr,
      status: subscription.status,
      trial_end: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
    },
    occurred_at: new Date(subscription.created * 1000).toISOString(),
  });

  console.log('Subscription created:', subscription.id, 'for person:', personId);
}

/**
 * Handle customer.subscription.updated event
 */
async function handleSubscriptionUpdated(supabase: any, event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;

  // Find person via identity_link
  const personId = await getOrCreatePersonFromCustomer(
    supabase,
    subscription.customer as string
  );

  if (!personId) {
    console.warn('Could not determine person_id for subscription update:', subscription.id);
    return;
  }

  // Extract plan details
  const planName = subscription.items.data[0]?.price.nickname || 'Unknown';
  const planId = subscription.items.data[0]?.price.id || null;
  const mrr =
    subscription.items.data[0]?.price.unit_amount
      ? subscription.items.data[0].price.unit_amount / 100
      : 0;

  // Update subscription record
  const { error: updateError } = await supabase
    .from('subscription')
    .upsert(
      {
        stripe_subscription_id: subscription.id,
        person_id: personId,
        status: subscription.status,
        plan_name: planName,
        plan_id: planId,
        mrr: mrr,
        current_period_start: new Date(
          subscription.current_period_start * 1000
        ).toISOString(),
        current_period_end: new Date(
          subscription.current_period_end * 1000
        ).toISOString(),
        canceled_at: subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000).toISOString()
          : null,
      },
      { onConflict: 'stripe_subscription_id' }
    );

  if (updateError) {
    console.error('Error updating subscription:', updateError);
    throw updateError;
  }

  // Create event for status change
  await supabase.from('event').insert({
    person_id: personId,
    event_name: `subscription_${subscription.status}`,
    event_source: 'stripe',
    properties: {
      subscription_id: subscription.id,
      plan: planName,
      status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
    occurred_at: new Date().toISOString(),
  });

  console.log('Subscription updated:', subscription.id, 'status:', subscription.status);
}

/**
 * Handle customer.subscription.deleted event
 */
async function handleSubscriptionDeleted(supabase: any, event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;

  // Find person via identity_link
  const personId = await getOrCreatePersonFromCustomer(
    supabase,
    subscription.customer as string
  );

  if (!personId) {
    console.warn('Could not determine person_id for subscription deletion:', subscription.id);
    return;
  }

  // Update subscription status to canceled
  const { error: updateError } = await supabase
    .from('subscription')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  if (updateError) {
    console.error('Error marking subscription as canceled:', updateError);
  }

  // Create event
  await supabase.from('event').insert({
    person_id: personId,
    event_name: 'subscription_canceled',
    event_source: 'stripe',
    properties: {
      subscription_id: subscription.id,
      status: 'canceled',
    },
    occurred_at: new Date().toISOString(),
  });

  console.log('Subscription deleted:', subscription.id);
}

/**
 * Handle invoice.paid event
 */
async function handleInvoicePaid(supabase: any, event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;

  if (!invoice.subscription) {
    // Not a subscription invoice, ignore
    return;
  }

  // Find person via customer
  const personId = await getOrCreatePersonFromCustomer(
    supabase,
    invoice.customer as string
  );

  if (!personId) {
    console.warn('Could not determine person_id for invoice paid:', invoice.id);
    return;
  }

  // Create event for successful payment
  await supabase.from('event').insert({
    person_id: personId,
    event_name: 'subscription_payment_succeeded',
    event_source: 'stripe',
    properties: {
      invoice_id: invoice.id,
      subscription_id: invoice.subscription,
      amount: invoice.amount_paid / 100,
      currency: invoice.currency,
      billing_reason: invoice.billing_reason,
    },
    occurred_at: new Date(invoice.created * 1000).toISOString(),
  });

  console.log('Invoice paid:', invoice.id, 'for person:', personId);
}

/**
 * Handle invoice.payment_failed event
 */
async function handleInvoicePaymentFailed(supabase: any, event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;

  if (!invoice.subscription) {
    // Not a subscription invoice, ignore
    return;
  }

  // Find person via customer
  const personId = await getOrCreatePersonFromCustomer(
    supabase,
    invoice.customer as string
  );

  if (!personId) {
    console.warn('Could not determine person_id for payment failure:', invoice.id);
    return;
  }

  // Update subscription status to past_due
  await supabase
    .from('subscription')
    .update({ status: 'past_due' })
    .eq('stripe_subscription_id', invoice.subscription);

  // Create event for failed payment
  await supabase.from('event').insert({
    person_id: personId,
    event_name: 'subscription_payment_failed',
    event_source: 'stripe',
    properties: {
      invoice_id: invoice.id,
      subscription_id: invoice.subscription,
      amount_due: invoice.amount_due / 100,
      currency: invoice.currency,
      attempt_count: invoice.attempt_count,
    },
    occurred_at: new Date(invoice.created * 1000).toISOString(),
  });

  console.log('Invoice payment failed:', invoice.id, 'for person:', personId);
}
