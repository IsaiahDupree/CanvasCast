/**
 * PageView Tracking Tests (META-002)
 * Tests for automatic PageView tracking on route changes
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { PageViewTracker } from '@/components/PageViewTracker';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

// Mock Meta Pixel library
vi.mock('@/lib/meta-pixel', () => ({
  trackMetaEvent: vi.fn(),
  isMetaPixelLoaded: vi.fn(() => true),
  META_EVENTS: {
    PAGE_VIEW: 'PageView',
  },
}));

describe('PageView Tracking (META-002)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset isMetaPixelLoaded to return true by default
    const { isMetaPixelLoaded } = await import('@/lib/meta-pixel');
    (isMetaPixelLoaded as any).mockReturnValue(true);
  });

  describe('PageViewTracker Component', () => {
    it('should track PageView event on mount', async () => {
      const { trackMetaEvent } = await import('@/lib/meta-pixel');
      (usePathname as any).mockReturnValue('/');

      render(<PageViewTracker />);

      await waitFor(() => {
        expect(trackMetaEvent).toHaveBeenCalledWith('PageView', {
          page_path: '/',
          page_title: expect.any(String),
        });
      });
    });

    it('should track PageView event when pathname changes', async () => {
      const { trackMetaEvent } = await import('@/lib/meta-pixel');
      let pathname = '/';
      (usePathname as any).mockImplementation(() => pathname);

      const { rerender } = render(<PageViewTracker />);

      await waitFor(() => {
        expect(trackMetaEvent).toHaveBeenCalledWith('PageView', {
          page_path: '/',
          page_title: expect.any(String),
        });
      });

      // Clear previous calls
      vi.clearAllMocks();

      // Change pathname
      pathname = '/pricing';
      (usePathname as any).mockReturnValue('/pricing');
      rerender(<PageViewTracker />);

      await waitFor(() => {
        expect(trackMetaEvent).toHaveBeenCalledWith('PageView', {
          page_path: '/pricing',
          page_title: expect.any(String),
        });
      });
    });

    it('should not track PageView if Meta Pixel is not loaded', async () => {
      const { trackMetaEvent, isMetaPixelLoaded } = await import('@/lib/meta-pixel');
      (isMetaPixelLoaded as any).mockReturnValue(false);
      (usePathname as any).mockReturnValue('/');

      render(<PageViewTracker />);

      // Wait a bit to ensure no event is tracked
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(trackMetaEvent).not.toHaveBeenCalled();
    });

    it('should include page title in PageView event', async () => {
      const { trackMetaEvent } = await import('@/lib/meta-pixel');
      (usePathname as any).mockReturnValue('/pricing');

      // Mock document.title
      Object.defineProperty(document, 'title', {
        value: 'Pricing - CanvasCast',
        writable: true,
        configurable: true,
      });

      render(<PageViewTracker />);

      await waitFor(() => {
        expect(trackMetaEvent).toHaveBeenCalledWith('PageView', {
          page_path: '/pricing',
          page_title: 'Pricing - CanvasCast',
        });
      });
    });

    it('should only track once per pathname change', async () => {
      const { trackMetaEvent } = await import('@/lib/meta-pixel');
      (usePathname as any).mockReturnValue('/');

      const { rerender } = render(<PageViewTracker />);

      await waitFor(() => {
        expect(trackMetaEvent).toHaveBeenCalledTimes(1);
      });

      // Rerender with same pathname - should not track again
      rerender(<PageViewTracker />);

      // Wait a bit to ensure no additional event is tracked
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(trackMetaEvent).toHaveBeenCalledTimes(1);
    });
  });
});
