'use client';

import { useEffect } from 'react';
import { trackFunnelEvent, FUNNEL_EVENTS } from '@/lib/analytics';

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
 */
export function LandingTracker() {
  useEffect(() => {
    const referrer = document.referrer || 'direct';
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get('utm_source');
    const utmMedium = params.get('utm_medium');
    const utmCampaign = params.get('utm_campaign');

    trackFunnelEvent(FUNNEL_EVENTS.LANDING_VIEWED, {
      referrer,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      url: window.location.href,
    });
  }, []);

  return null;
}
