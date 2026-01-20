'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { initPostHog, trackPageView, identifyUser } from '@/lib/analytics';
import { useAuth } from '@/hooks/useAuth';

/**
 * PostHog Analytics Provider
 * Initializes PostHog and tracks page views
 * Respects cookie consent preferences
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [consentChecked, setConsentChecked] = useState(false);

  // Initialize PostHog on mount and when consent changes
  useEffect(() => {
    initPostHog();
    setConsentChecked(true);

    // Listen for storage changes (cookie consent updates)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cookie-consent') {
        // Reload the page to reinitialize PostHog with new consent
        window.location.reload();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Track page views on route changes
  useEffect(() => {
    if (pathname && consentChecked) {
      const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
      trackPageView(url);
    }
  }, [pathname, searchParams, consentChecked]);

  // Identify user when logged in
  useEffect(() => {
    if (user?.id && consentChecked) {
      identifyUser(user.id, {
        email: user.email,
        created_at: user.created_at,
      });
    }
  }, [user, consentChecked]);

  return <>{children}</>;
}
