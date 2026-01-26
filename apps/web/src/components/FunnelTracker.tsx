'use client';

import { useEffect } from 'react';
import { trackFunnelEvent, FUNNEL_EVENTS, trackAcquisitionEvent, ACQUISITION_EVENTS, extractUtmParams } from '@/lib/analytics';

interface FunnelTrackerProps {
  event: string;
  properties?: Record<string, any>;
}

/**
 * Client component to track funnel events
 * Must be used in client components or with 'use client' directive
 */
export function FunnelTracker({ event, properties }: FunnelTrackerProps) {
  useEffect(() => {
    trackFunnelEvent(event, properties);
  }, [event, properties]);

  return null;
}

/**
 * Component to track landing page views
 * TRACK-002: Tracks both funnel events and acquisition events
 */
export function LandingTracker() {
  useEffect(() => {
    const referrer = document.referrer || 'direct';
    const params = new URLSearchParams(window.location.search);

    // Extract UTM parameters using the helper function
    const utmParams = extractUtmParams(params);

    const eventProps = {
      referrer,
      url: window.location.href,
      ...utmParams,
    };

    // Track as both a funnel event and acquisition event
    trackFunnelEvent(FUNNEL_EVENTS.LANDING_VIEWED, eventProps);
    trackAcquisitionEvent(ACQUISITION_EVENTS.LANDING_VIEW, eventProps);
  }, []);

  return null;
}
