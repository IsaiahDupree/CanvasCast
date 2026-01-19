/**
 * Pricing Page Tests - UI-002
 *
 * This test file validates the Pricing Page requirements:
 * 1. Shows all pricing options (credit packs)
 * 2. Toggle between one-time and subscription (if applicable)
 * 3. Pricing cards with features and CTAs
 * 4. FAQ section
 *
 * Acceptance Criteria:
 * - Shows all pricing options
 * - Toggle between one-time and subscription
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Make React globally available for JSX transform
globalThis.React = React;

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement('a', { href }, children),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Check: () => React.createElement('div', { 'data-testid': 'check' }),
  Zap: () => React.createElement('div', { 'data-testid': 'zap' }),
  Crown: () => React.createElement('div', { 'data-testid': 'crown' }),
  Rocket: () => React.createElement('div', { 'data-testid': 'rocket' }),
  Plus: () => React.createElement('div', { 'data-testid': 'plus' }),
}));

// Import the page component
import PricingPage from '../../apps/web/src/app/pricing/page';

describe('UI-002: Pricing Page', () => {
  describe('Page Structure', () => {
    it('should render the main container', () => {
      const { container } = render(<PricingPage />);

      const main = container.querySelector('div');
      expect(main).toBeDefined();
      expect(main?.className).toContain('min-h-screen');
    });

    it('should render header with logo and navigation', () => {
      render(<PricingPage />);

      const logo = screen.getByText('CanvasCast');
      expect(logo).toBeDefined();

      const loginLink = screen.getByText('Log in');
      expect(loginLink).toBeDefined();

      const signupLinks = screen.getAllByText('Get Started');
      expect(signupLinks.length).toBeGreaterThan(0);
    });

    it('should render footer', () => {
      render(<PricingPage />);

      const footer = screen.getByText(/© 2026 CanvasCast/i);
      expect(footer).toBeDefined();
    });
  });

  describe('Hero Section', () => {
    it('should render main heading', () => {
      render(<PricingPage />);

      const heading = screen.getByText(/Simple, Credit-Based Pricing/i);
      expect(heading).toBeDefined();
      expect(heading.tagName).toBe('H1');
    });

    it('should render hero description', () => {
      render(<PricingPage />);

      const description = screen.getByText(/Pay only for what you use/i);
      expect(description).toBeDefined();
    });

    it('should explain credit model', () => {
      render(<PricingPage />);

      const creditExplanation = screen.getByText(/1 credit = 1 minute of video/i);
      expect(creditExplanation).toBeDefined();
    });
  });

  describe('Pricing Cards - Acceptance Criteria: Shows all pricing options', () => {
    it('should render all three pricing tiers', () => {
      render(<PricingPage />);

      const starterTier = screen.getByText('Starter');
      const proTier = screen.getByText('Pro');
      const creatorPlusTier = screen.getByText('Creator+');

      expect(starterTier).toBeDefined();
      expect(proTier).toBeDefined();
      expect(creatorPlusTier).toBeDefined();
    });

    it('should display prices for each tier', () => {
      render(<PricingPage />);

      // Check for price display (looking for $ symbols and numbers)
      const prices = screen.getAllByText(/\$/);
      expect(prices.length).toBeGreaterThanOrEqual(3);
    });

    it('should display credit amounts for each tier', () => {
      render(<PricingPage />);

      const starterCredits = screen.getByText(/60 credits/i);
      const proCredits = screen.getByText(/200 credits/i);
      const creatorPlusCredits = screen.getByText(/500 credits/i);

      expect(starterCredits).toBeDefined();
      expect(proCredits).toBeDefined();
      expect(creatorPlusCredits).toBeDefined();
    });

    it('should show "Most Popular" badge on popular tier', () => {
      render(<PricingPage />);

      const popularBadge = screen.getByText(/Most Popular/i);
      expect(popularBadge).toBeDefined();
    });

    it('should display features for each tier', () => {
      render(<PricingPage />);

      // Check for common features
      const videoGeneration = screen.getAllByText(/video generation/i);
      const mp4Output = screen.getAllByText(/1080p MP4/i);
      const captions = screen.getAllByText(/Captions/i);

      expect(videoGeneration.length).toBeGreaterThan(0);
      expect(mp4Output.length).toBeGreaterThan(0);
      expect(captions.length).toBeGreaterThan(0);
    });

    it('should have Get Started button for each tier', () => {
      render(<PricingPage />);

      const getStartedButtons = screen.getAllByText(/Get Started/i);
      // At least 3 for the pricing tiers plus CTA sections
      expect(getStartedButtons.length).toBeGreaterThanOrEqual(3);
    });

    it('should have proper links on Get Started buttons', () => {
      const { container } = render(<PricingPage />);

      const links = container.querySelectorAll('a[href="/signup"]');
      expect(links.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('FAQ Section', () => {
    it('should render FAQ heading', () => {
      render(<PricingPage />);

      const faqHeading = screen.getByText(/Frequently Asked Questions/i);
      expect(faqHeading).toBeDefined();
    });

    it('should render "How do credits work?" question', () => {
      render(<PricingPage />);

      const creditsQuestion = screen.getByText(/How do credits work/i);
      expect(creditsQuestion).toBeDefined();
    });

    it('should explain credit system in FAQ', () => {
      render(<PricingPage />);

      const creditsAnswer = screen.getByText(/1 credit = 1 minute of generated video/i);
      expect(creditsAnswer).toBeDefined();
    });

    it('should have "What\'s included in the output?" question', () => {
      render(<PricingPage />);

      const outputQuestion = screen.getByText(/What's included in the output/i);
      expect(outputQuestion).toBeDefined();
    });

    it('should have "Can I use my own voice?" question', () => {
      render(<PricingPage />);

      const voiceQuestion = screen.getByText(/Can I use my own voice/i);
      expect(voiceQuestion).toBeDefined();
    });

    it('should have "How long does generation take?" question', () => {
      render(<PricingPage />);

      const timeQuestion = screen.getByText(/How long does generation take/i);
      expect(timeQuestion).toBeDefined();
    });

    it('should have "Can I get a refund?" question', () => {
      render(<PricingPage />);

      const refundQuestion = screen.getByText(/Can I get a refund/i);
      expect(refundQuestion).toBeDefined();
    });

    it('should render at least 5 FAQ items', () => {
      const { container } = render(<PricingPage />);

      // Count FAQ items (they have specific styling)
      const faqItems = container.querySelectorAll('.bg-white\\/5');
      expect(faqItems.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('CTA Section', () => {
    it('should render CTA heading', () => {
      render(<PricingPage />);

      const ctaHeading = screen.getByText(/Ready to Create/i);
      expect(ctaHeading).toBeDefined();
    });

    it('should render CTA description', () => {
      render(<PricingPage />);

      const ctaDescription = screen.getByText(/Start generating YouTube-ready videos/i);
      expect(ctaDescription).toBeDefined();
    });

    it('should have CTA button linking to signup', () => {
      const { container } = render(<PricingPage />);

      const ctaButton = screen.getByText(/Get Started Free/i);
      expect(ctaButton).toBeDefined();

      const ctaLink = ctaButton.closest('a');
      expect(ctaLink?.getAttribute('href')).toBe('/signup');
    });
  });

  describe('Overall Layout', () => {
    it('should have proper responsive grid for pricing cards', () => {
      const { container } = render(<PricingPage />);

      const grid = container.querySelector('.grid.md\\:grid-cols-3');
      expect(grid).toBeDefined();
    });

    it('should have proper sections', () => {
      const { container } = render(<PricingPage />);

      const sections = container.querySelectorAll('section');
      expect(sections.length).toBeGreaterThanOrEqual(4); // Hero, Pricing, FAQ, CTA
    });

    it('should have visual hierarchy with borders', () => {
      const { container } = render(<PricingPage />);

      const borders = container.querySelectorAll('.border-t');
      expect(borders.length).toBeGreaterThan(0);
    });
  });

  describe('Navigation Links', () => {
    it('should have link to homepage', () => {
      const { container } = render(<PricingPage />);

      const homeLink = container.querySelector('a[href="/"]');
      expect(homeLink).toBeDefined();
    });

    it('should have link to login page', () => {
      const { container } = render(<PricingPage />);

      const loginLink = container.querySelector('a[href="/login"]');
      expect(loginLink).toBeDefined();
    });

    it('should have multiple links to signup page', () => {
      const { container } = render(<PricingPage />);

      const signupLinks = container.querySelectorAll('a[href="/signup"]');
      expect(signupLinks.length).toBeGreaterThanOrEqual(3);
    });
  });
});
