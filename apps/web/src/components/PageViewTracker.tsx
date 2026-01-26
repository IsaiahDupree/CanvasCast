'use client';

/**
 * PageView Tracker Component (META-002)
 * Automatically tracks PageView events with Meta Pixel on route changes
 *
 * This component should be included in the app layout to track all page navigations.
 * It uses Next.js usePathname hook to detect route changes and sends PageView events
 * to Meta Pixel including page_path and page_title properties.
 *
 * Features:
 * - Automatic tracking on mount and route change
 * - Respects Meta Pixel initialization state
 * - Includes page path and title in event data
 * - Only tracks once per pathname to avoid duplicates
 */

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { trackMetaEvent, isMetaPixelLoaded, META_EVENTS } from '@/lib/meta-pixel';

export function PageViewTracker() {
  const pathname = usePathname();
  const previousPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    // Don't track if Meta Pixel is not loaded
    if (!isMetaPixelLoaded()) {
      return;
    }

    // Don't track if pathname hasn't changed
    if (previousPathnameRef.current === pathname) {
      return;
    }

    // Update the previous pathname
    previousPathnameRef.current = pathname;

    // Track PageView event with page path and title
    trackMetaEvent(META_EVENTS.PAGE_VIEW, {
      page_path: pathname,
      page_title: typeof document !== 'undefined' ? document.title : '',
    });
  }, [pathname]);

  // This component doesn't render anything
  return null;
}
