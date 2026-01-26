"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  trackActivationEvent,
  identifyUser,
  identifyUserForPostHog,
  ACTIVATION_EVENTS,
} from "@/lib/analytics";
import { createBrowserClient } from "@supabase/ssr";

interface ActivationTrackerProps {
  creditsBalance?: number;
}

/**
 * Client component that tracks activation events
 * Tracks login_success and activation_complete events based on user state
 * TRACK-003: Activation Event Tracking
 * TRACK-008: User Identification
 */
export function ActivationTracker({ creditsBalance }: ActivationTrackerProps) {
  const { user, loading } = useAuth();
  const [userTraits, setUserTraits] = useState<Record<string, any>>({});

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    // Fetch user profile data for comprehensive identification
    const fetchUserProfile = async () => {
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data: profile } = await supabase
          .from("profiles")
          .select("subscription_tier, stripe_customer_id")
          .eq("id", user.id)
          .maybeSingle();

        const traits = {
          email: user.email,
          created_at: user.created_at,
          plan: profile?.subscription_tier || 'free',
          credits: creditsBalance,
          has_stripe_customer: !!profile?.stripe_customer_id,
        };

        setUserTraits(traits);
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
        // Set basic traits on error
        setUserTraits({
          email: user.email,
          created_at: user.created_at,
          credits: creditsBalance,
        });
      }
    };

    fetchUserProfile();
  }, [user, loading, creditsBalance]);

  useEffect(() => {
    if (loading || !user || Object.keys(userTraits).length === 0) {
      return;
    }

    // Check if this is a new session (user just logged in)
    const sessionKey = `activation_tracked_${user.id}`;
    const alreadyTracked = sessionStorage.getItem(sessionKey);

    if (!alreadyTracked) {
      // Determine if this is a new user by checking their created_at timestamp
      const userCreatedAt = new Date(user.created_at || 0).getTime();
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      const isNewUser = now - userCreatedAt < fiveMinutes;

      // Track login success
      trackActivationEvent(ACTIVATION_EVENTS.LOGIN_SUCCESS, {
        user_id: user.id,
        method: user.app_metadata?.provider || 'email',
        is_new_user: isNewUser,
      });

      // GDP-009: PostHog Identity Stitching
      // Stitch anonymous session to identified user in PostHog
      // This must be called on every login to ensure anonymous pre-auth activity
      // is linked to the authenticated user
      identifyUserForPostHog(user.id, userTraits);

      // Identify user in PostHog with comprehensive traits (TRACK-008)
      // This also identifies for Meta Pixel custom audiences
      identifyUser(user.id, userTraits);

      // Track activation complete (user successfully reached the app)
      trackActivationEvent(ACTIVATION_EVENTS.ACTIVATION_COMPLETE, {
        user_id: user.id,
        is_new_user: isNewUser,
        credits_balance: creditsBalance,
      });

      // Mark as tracked for this session
      sessionStorage.setItem(sessionKey, 'true');
    }
  }, [user, loading, creditsBalance, userTraits]);

  // This component doesn't render anything
  return null;
}
