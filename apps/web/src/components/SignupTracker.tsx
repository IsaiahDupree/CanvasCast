'use client';

import { useEffect, useState } from 'react';
import { trackFunnelEvent, FUNNEL_EVENTS, identifyUser } from '@/lib/analytics';
import { createClient } from '@/lib/supabase/client';

/**
 * Tracks signup completion for new users
 * Should be placed in the authenticated app layout
 */
export function SignupTracker() {
  const [tracked, setTracked] = useState(false);

  useEffect(() => {
    if (tracked) return;

    const trackSignup = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return;

        // Identify user in analytics
        identifyUser(user.id, {
          email: user.email,
          created_at: user.created_at,
        });

        // Check if user is new (created within last 5 minutes)
        const userCreatedAt = new Date(user.created_at);
        const now = new Date();
        const timeDiff = now.getTime() - userCreatedAt.getTime();
        const minutesDiff = timeDiff / (1000 * 60);

        // If user was created within last 5 minutes, track signup completion
        if (minutesDiff <= 5) {
          // Check URL params to see if they came from draft flow
          const params = new URLSearchParams(window.location.search);
          const hasDraft = params.has('draft');

          // Get signup method from user metadata
          const signupMethod = user.app_metadata?.provider || 'email';

          trackFunnelEvent(FUNNEL_EVENTS.SIGNUP_COMPLETED, {
            user_id: user.id,
            signup_method: signupMethod,
            has_draft: hasDraft,
            email: user.email,
          });

          setTracked(true);
        }
      } catch (error) {
        console.error('Error tracking signup:', error);
      }
    };

    trackSignup();
  }, [tracked]);

  return null;
}
