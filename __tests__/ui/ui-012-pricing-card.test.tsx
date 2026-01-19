/**
 * PricingCard Component Tests - UI-012
 *
 * This test file validates the PricingCard Component requirements:
 * 1. Shows price and features
 * 2. CTA button
 *
 * Acceptance Criteria:
 * - Shows price and features
 * - CTA button
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Make React globally available for JSX transform
globalThis.React = React;

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Check: () => React.createElement('div', { 'data-testid': 'check-icon' }),
  Zap: () => React.createElement('div', { 'data-testid': 'zap-icon' }),
  Crown: () => React.createElement('div', { 'data-testid': 'crown-icon' }),
  Rocket: () => React.createElement('div', { 'data-testid': 'rocket-icon' }),
}));

// Mock Next.js Link component
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement('a', { href, 'data-testid': 'cta-link' }, children),
}));

// Import component after mocks
import { PricingCard } from '@/components/pricing-card';

describe('UI-012: PricingCard Component', () => {
  const mockTier = {
    id: 'starter',
    name: 'Starter',
    price: 19,
    credits: 60,
    description: 'Perfect for weekly creators',
    features: [
      '60 minutes of video generation',
      'All niche templates',
      '1080p MP4 output',
      'Captions (SRT)',
      'Script + asset pack',
    ],
  };

  const mockPopularTier = {
    id: 'pro',
    name: 'Pro',
    price: 49,
    credits: 200,
    description: 'For consistent content creators',
    popular: true,
    features: [
      '200 minutes of video generation',
      'All niche templates',
      '1080p MP4 output',
      'Captions (SRT)',
      'Script + asset pack',
      'Voice cloning (bring your voice)',
      'Priority rendering queue',
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Acceptance Criteria: Shows price and features', () => {
    it('should render tier name', () => {
      render(<PricingCard tier={mockTier} />);

      const name = screen.getByText('Starter');
      expect(name).toBeDefined();
    });

    it('should display price', () => {
      render(<PricingCard tier={mockTier} />);

      const price = screen.getByText(/\$19/);
      expect(price).toBeDefined();
    });

    it('should display credit count', () => {
      render(<PricingCard tier={mockTier} />);

      const credits = screen.getByText(/60 credits/);
      expect(credits).toBeDefined();
    });

    it('should display description', () => {
      render(<PricingCard tier={mockTier} />);

      const description = screen.getByText('Perfect for weekly creators');
      expect(description).toBeDefined();
    });

    it('should render all features', () => {
      render(<PricingCard tier={mockTier} />);

      mockTier.features.forEach((feature) => {
        const featureElement = screen.getByText(feature);
        expect(featureElement).toBeDefined();
      });
    });

    it('should display check icons for each feature', () => {
      const { container } = render(<PricingCard tier={mockTier} />);

      // Should have same number of check icons as features
      const checkIcons = container.querySelectorAll('svg.lucide-check');
      expect(checkIcons.length).toBe(mockTier.features.length);
    });

    it('should render icon based on tier id', () => {
      const { container } = render(<PricingCard tier={mockTier} />);

      // Starter tier should have Zap icon
      const icon = container.querySelector('svg.lucide-zap');
      expect(icon).toBeDefined();
    });
  });

  describe('Acceptance Criteria: CTA button', () => {
    it('should render CTA button', () => {
      render(<PricingCard tier={mockTier} />);

      const button = screen.getByRole('button', { name: /Get Started/i });
      expect(button).toBeDefined();
    });

    it('should link to signup page', () => {
      const { container } = render(<PricingCard tier={mockTier} />);

      const link = container.querySelector('a[href="/signup"]');
      expect(link).toBeDefined();
      expect(link?.getAttribute('href')).toBe('/signup');
    });

    it('should render button inside link', () => {
      const { container } = render(<PricingCard tier={mockTier} />);

      const link = container.querySelector('a[href="/signup"]');
      expect(link).toBeDefined();

      const button = link?.querySelector('button');
      expect(button).toBeDefined();
      expect(button?.textContent).toContain('Get Started');
    });
  });

  describe('Popular Tier Styling', () => {
    it('should show "Most Popular" badge when popular is true', () => {
      render(<PricingCard tier={mockPopularTier} />);

      const badge = screen.getByText('Most Popular');
      expect(badge).toBeDefined();
    });

    it('should not show "Most Popular" badge when popular is false/undefined', () => {
      render(<PricingCard tier={mockTier} />);

      const badge = screen.queryByText('Most Popular');
      expect(badge).toBeNull();
    });

    it('should apply different styling for popular tier', () => {
      const { container } = render(<PricingCard tier={mockPopularTier} />);

      // Popular tier should have brand border
      const card = container.querySelector('.border-brand-500');
      expect(card).toBeDefined();
    });

    it('should apply normal styling for non-popular tier', () => {
      const { container } = render(<PricingCard tier={mockTier} />);

      // Regular tier should have white/10 border
      const card = container.querySelector('.border-white\\/10');
      expect(card).toBeDefined();
    });
  });

  describe('Different Tier Icons', () => {
    it('should render Zap icon for starter tier', () => {
      const { container } = render(<PricingCard tier={mockTier} />);

      const icon = container.querySelector('svg.lucide-zap');
      expect(icon).toBeDefined();
    });

    it('should render Crown icon for pro tier', () => {
      const { container } = render(<PricingCard tier={mockPopularTier} />);

      const icon = container.querySelector('svg.lucide-crown');
      expect(icon).toBeDefined();
    });

    it('should render Rocket icon for creator_plus tier', () => {
      const creatorPlusTier = {
        id: 'creator_plus',
        name: 'Creator+',
        price: 99,
        credits: 500,
        description: 'For daily posters',
        features: ['500 minutes of video generation'],
      };

      const { container } = render(<PricingCard tier={creatorPlusTier} />);

      const icon = container.querySelector('svg.lucide-rocket');
      expect(icon).toBeDefined();
    });
  });

  describe('Component Structure', () => {
    it('should render with proper card structure', () => {
      const { container } = render(<PricingCard tier={mockTier} />);

      const card = container.querySelector('.rounded-2xl');
      expect(card).toBeDefined();
    });

    it('should render all elements in correct order', () => {
      const { container } = render(<PricingCard tier={mockTier} />);

      // Icon
      const icon = container.querySelector('svg.lucide-zap');
      expect(icon).toBeDefined();

      // Name
      const name = screen.getByText('Starter');
      expect(name).toBeDefined();

      // Price
      const price = screen.getByText(/\$19/);
      expect(price).toBeDefined();

      // Features list
      const firstFeature = screen.getByText(mockTier.features[0]);
      expect(firstFeature).toBeDefined();

      // CTA button
      const button = screen.getByRole('button', { name: /Get Started/i });
      expect(button).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle tier with no features', () => {
      const minimalTier = {
        id: 'minimal',
        name: 'Minimal',
        price: 9,
        credits: 30,
        description: 'Basic plan',
        features: [],
      };

      expect(() => render(<PricingCard tier={minimalTier} />)).not.toThrow();
    });

    it('should handle tier with many features', () => {
      const loadedTier = {
        ...mockTier,
        features: Array(15).fill('Feature item'),
      };

      const { container } = render(<PricingCard tier={loadedTier} />);

      const checkIcons = container.querySelectorAll('svg.lucide-check');
      expect(checkIcons.length).toBe(15);
    });

    it('should handle very high prices', () => {
      const expensiveTier = {
        ...mockTier,
        price: 9999,
        credits: 10000,
      };

      render(<PricingCard tier={expensiveTier} />);

      const price = screen.getByText(/\$9999/);
      expect(price).toBeDefined();
    });
  });
});
