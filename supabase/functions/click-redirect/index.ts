/**
 * GDP-006: Click Redirect Tracker Edge Function
 *
 * Handles click tracking for email links:
 * 1. Records click in click_attribution table
 * 2. Sets first-party cookie (_cc_click) with click token
 * 3. Redirects to target URL
 *
 * Query Parameters:
 * - email_id: UUID of email_message record
 * - target: Destination URL to redirect to
 *
 * This builds the attribution spine: email → click → session → conversion
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds

serve(async (req) => {
  try {
    // Only accept GET requests
    if (req.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse query parameters
    const url = new URL(req.url);
    const emailMessageId = url.searchParams.get('email_id');
    const targetUrl = url.searchParams.get('target');

    // Validate parameters
    if (!emailMessageId) {
      return new Response(
        JSON.stringify({ error: 'Missing email_id parameter' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!targetUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing target parameter' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Extract user agent and IP
    const userAgent = req.headers.get('user-agent') || '';
    const ipAddress = req.headers.get('x-forwarded-for') ||
                     req.headers.get('x-real-ip') ||
                     'unknown';

    // Generate unique click token
    const clickToken = generateClickToken();

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Record click in database
    const { error: insertError } = await supabase
      .from('click_attribution')
      .insert({
        email_message_id: emailMessageId,
        click_token: clickToken,
        link_url: targetUrl,
        user_agent: userAgent,
        ip_address: ipAddress,
      });

    if (insertError) {
      console.error('Error recording click:', insertError);
      // Continue with redirect even if tracking fails
    }

    // Set first-party cookie with click token
    const cookieHeader = `_cc_click=${clickToken}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax; Secure; HttpOnly`;

    // Redirect to target URL
    return new Response(null, {
      status: 302,
      headers: {
        'Location': targetUrl,
        'Set-Cookie': cookieHeader,
      },
    });
  } catch (error) {
    console.error('Error in click-redirect:', error);
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
 * Generate a unique click token
 * Format: ct_{timestamp}_{random}
 */
function generateClickToken(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `ct_${timestamp}_${random}`;
}
