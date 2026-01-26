/**
 * GDP-004: Resend Webhook Edge Function
 *
 * Receives webhooks from Resend for email events:
 * - email.delivered
 * - email.opened
 * - email.clicked
 * - email.bounced
 * - email.complained
 *
 * Verifies Svix signature, stores events in database, and maps person_id via tags.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { Webhook } from 'https://esm.sh/@svix/svix-js@1.34.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SVIX_WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ResendWebhookPayload {
  type: string;
  created_at: string;
  data: {
    email_id?: string;
    to: string;
    from?: string;
    subject?: string;
    tags?: Array<{ name: string; value: string }>;
    click?: {
      link: string;
      user_agent?: string;
      ip_address?: string;
    };
  };
}

serve(async (req) => {
  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get headers for Svix verification
    const svixId = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSignature = req.headers.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response(
        JSON.stringify({ error: 'Missing Svix signature headers' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Read raw body for signature verification
    const body = await req.text();

    // Verify Svix signature if secret is configured
    if (SVIX_WEBHOOK_SECRET) {
      const wh = new Webhook(SVIX_WEBHOOK_SECRET);
      try {
        wh.verify(body, {
          'svix-id': svixId,
          'svix-timestamp': svixTimestamp,
          'svix-signature': svixSignature,
        });
      } catch (err) {
        console.error('Svix signature verification failed:', err);
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Parse webhook payload
    const payload: ResendWebhookPayload = JSON.parse(body);
    console.log('Received webhook:', payload.type, payload.data.email_id);

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Extract person_id from tags if present
    let personId: string | null = null;
    if (payload.data.tags) {
      const personIdTag = payload.data.tags.find(
        (tag) => tag.name === 'person_id'
      );
      if (personIdTag) {
        personId = personIdTag.value;
      }
    }

    // Handle different event types
    switch (payload.type) {
      case 'email.delivered':
        await handleEmailDelivered(supabase, payload, personId);
        break;
      case 'email.opened':
        await handleEmailOpened(supabase, payload);
        break;
      case 'email.clicked':
        await handleEmailClicked(supabase, payload);
        break;
      case 'email.bounced':
        await handleEmailBounced(supabase, payload);
        break;
      case 'email.complained':
        await handleEmailComplained(supabase, payload);
        break;
      default:
        console.warn('Unknown event type:', payload.type);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
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
 * Handle email.delivered event
 * Creates email_message record and email_event
 */
async function handleEmailDelivered(
  supabase: any,
  payload: ResendWebhookPayload,
  personId: string | null
) {
  const { data: emailMessage, error: emailError } = await supabase
    .from('email_message')
    .upsert({
      resend_email_id: payload.data.email_id,
      person_id: personId,
      subject: payload.data.subject,
      to_address: payload.data.to,
      from_address: payload.data.from,
      tags: payload.data.tags || [],
      sent_at: payload.created_at,
    }, {
      onConflict: 'resend_email_id',
    })
    .select()
    .single();

  if (emailError) {
    console.error('Error inserting email_message:', emailError);
    throw emailError;
  }

  // Insert email_event for delivered
  const { error: eventError } = await supabase.from('email_event').insert({
    email_message_id: emailMessage.id,
    event_type: 'delivered',
    occurred_at: payload.created_at,
  });

  if (eventError) {
    console.error('Error inserting email_event:', eventError);
    throw eventError;
  }
}

/**
 * Handle email.opened event
 */
async function handleEmailOpened(
  supabase: any,
  payload: ResendWebhookPayload
) {
  // Find email_message by resend_email_id
  const { data: emailMessage, error: findError } = await supabase
    .from('email_message')
    .select('id')
    .eq('resend_email_id', payload.data.email_id)
    .single();

  if (findError || !emailMessage) {
    console.warn('Email message not found for opened event:', payload.data.email_id);
    return;
  }

  // Insert email_event for opened
  const { error: eventError } = await supabase.from('email_event').insert({
    email_message_id: emailMessage.id,
    event_type: 'opened',
    occurred_at: payload.created_at,
  });

  if (eventError) {
    console.error('Error inserting email_event:', eventError);
    throw eventError;
  }
}

/**
 * Handle email.clicked event
 */
async function handleEmailClicked(
  supabase: any,
  payload: ResendWebhookPayload
) {
  // Find email_message by resend_email_id
  const { data: emailMessage, error: findError } = await supabase
    .from('email_message')
    .select('id')
    .eq('resend_email_id', payload.data.email_id)
    .single();

  if (findError || !emailMessage) {
    console.warn('Email message not found for clicked event:', payload.data.email_id);
    return;
  }

  // Insert email_event for clicked with link data
  const { error: eventError } = await supabase.from('email_event').insert({
    email_message_id: emailMessage.id,
    event_type: 'clicked',
    link_url: payload.data.click?.link,
    user_agent: payload.data.click?.user_agent,
    ip_address: payload.data.click?.ip_address,
    occurred_at: payload.created_at,
  });

  if (eventError) {
    console.error('Error inserting email_event:', eventError);
    throw eventError;
  }
}

/**
 * Handle email.bounced event
 */
async function handleEmailBounced(
  supabase: any,
  payload: ResendWebhookPayload
) {
  // Find email_message by resend_email_id
  const { data: emailMessage, error: findError } = await supabase
    .from('email_message')
    .select('id')
    .eq('resend_email_id', payload.data.email_id)
    .single();

  if (findError || !emailMessage) {
    console.warn('Email message not found for bounced event:', payload.data.email_id);
    return;
  }

  // Insert email_event for bounced
  const { error: eventError } = await supabase.from('email_event').insert({
    email_message_id: emailMessage.id,
    event_type: 'bounced',
    occurred_at: payload.created_at,
  });

  if (eventError) {
    console.error('Error inserting email_event:', eventError);
    throw eventError;
  }
}

/**
 * Handle email.complained event
 */
async function handleEmailComplained(
  supabase: any,
  payload: ResendWebhookPayload
) {
  // Find email_message by resend_email_id
  const { data: emailMessage, error: findError } = await supabase
    .from('email_message')
    .select('id')
    .eq('resend_email_id', payload.data.email_id)
    .single();

  if (findError || !emailMessage) {
    console.warn('Email message not found for complained event:', payload.data.email_id);
    return;
  }

  // Insert email_event for complained
  const { error: eventError } = await supabase.from('email_event').insert({
    email_message_id: emailMessage.id,
    event_type: 'complained',
    occurred_at: payload.created_at,
  });

  if (eventError) {
    console.error('Error inserting email_event:', eventError);
    throw eventError;
  }
}
