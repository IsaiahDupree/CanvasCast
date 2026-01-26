'use client';

/**
 * Meta Pixel Provider (META-001)
 * Initializes Meta Pixel on app startup
 * Respects cookie consent preferences
 */

import { useEffect } from 'react';
import { initMetaPixel } from '@/lib/meta-pixel';

export function MetaPixelProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize Meta Pixel with the pixel ID from environment variables
    const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
    if (pixelId) {
      initMetaPixel(pixelId);
    }
  }, []);

  return <>{children}</>;
}
