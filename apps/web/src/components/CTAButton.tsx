'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { trackAcquisitionEvent, ACQUISITION_EVENTS, extractUtmParams } from '@/lib/analytics';

interface CTAButtonProps {
  href: string;
  location: string;
  ctaText: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * CTA Button component that tracks clicks for acquisition funnel
 * TRACK-002: Acquisition Event Tracking
 */
export function CTAButton({ href, location, ctaText, children, className }: CTAButtonProps) {
  const handleClick = () => {
    // Extract UTM parameters from current URL
    const params = typeof window !== 'undefined'
      ? extractUtmParams(new URLSearchParams(window.location.search))
      : {};

    // Track CTA click with location and UTM params
    trackAcquisitionEvent(ACQUISITION_EVENTS.CTA_CLICK, {
      location,
      cta_text: ctaText,
      destination: href,
      ...params,
    });
  };

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
