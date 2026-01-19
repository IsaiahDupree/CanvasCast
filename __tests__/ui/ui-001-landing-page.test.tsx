/**
 * Landing Page Tests - UI-001
 *
 * This test file validates the Landing Page requirements:
 * 1. Hero section with heading and description
 * 2. Prompt input component
 * 3. Features grid (4 steps)
 * 4. CTA section
 *
 * Acceptance Criteria:
 * - Hero section
 * - Prompt input
 * - Features grid
 * - CTA
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  ArrowRight: () => React.createElement('div', { 'data-testid': 'arrow-right' }),
  Play: () => React.createElement('div', { 'data-testid': 'play' }),
  Sparkles: () => React.createElement('div', { 'data-testid': 'sparkles' }),
  Download: () => React.createElement('div', { 'data-testid': 'download' }),
  Mic: () => React.createElement('div', { 'data-testid': 'mic' }),
  Loader2: () => React.createElement('div', { 'data-testid': 'loader2' }),
}));

// Mock PromptInput component
vi.mock('../../apps/web/src/components/prompt-input', () => ({
  PromptInput: () => React.createElement('div', { 'data-testid': 'prompt-input' }, 'Prompt Input Component'),
}));

// Import the page component
import Home from '../../apps/web/src/app/page';

describe('UI-001: Landing Page', () => {
  describe('Hero Section - Acceptance Criteria: Hero section', () => {
    it('should render the main heading', () => {
      render(<Home />);

      const heading = screen.getByText(/Turn Your Ideas.*Into Videos/i);
      expect(heading).toBeDefined();
      expect(heading.tagName).toBe('H1');
    });

    it('should render the hero description', () => {
      render(<Home />);

      const description = screen.getByText(/Enter a prompt and we'll generate a professional video/i);
      expect(description).toBeDefined();
    });

    it('should render AI-Powered Video Creation badge', () => {
      render(<Home />);

      const badge = screen.getByText(/AI-Powered Video Creation/i);
      expect(badge).toBeDefined();
    });

    it('should render header with logo and navigation', () => {
      render(<Home />);

      const logo = screen.getByText('CanvasCast');
      expect(logo).toBeDefined();

      const pricingLink = screen.getByText('Pricing');
      expect(pricingLink).toBeDefined();

      const signInLink = screen.getByText('Sign In');
      expect(signInLink).toBeDefined();
    });
  });

  describe('Prompt Input - Acceptance Criteria: Prompt input', () => {
    it('should render the PromptInput component', () => {
      render(<Home />);

      const promptInput = screen.getByTestId('prompt-input');
      expect(promptInput).toBeDefined();
    });
  });

  describe('Features Grid - Acceptance Criteria: Features grid', () => {
    it('should render the "Create Videos in 4 Simple Steps" heading', () => {
      render(<Home />);

      const heading = screen.getByText(/Create Videos in 4 Simple Steps/i);
      expect(heading).toBeDefined();
    });

    it('should render all 4 feature steps', () => {
      render(<Home />);

      // Check for all 4 steps
      const step1 = screen.getByText(/Pick Your Niche/i);
      const step2 = screen.getByText(/Add Your Content/i);
      const step3 = screen.getByText(/Choose Your Voice/i);
      const step4 = screen.getByText(/Download & Publish/i);

      expect(step1).toBeDefined();
      expect(step2).toBeDefined();
      expect(step3).toBeDefined();
      expect(step4).toBeDefined();
    });

    it('should render step descriptions', () => {
      render(<Home />);

      const step1Desc = screen.getByText(/Choose from explainer, motivation, facts, history/i);
      const step2Desc = screen.getByText(/Paste your notes, upload documents/i);
      const step3Desc = screen.getByText(/Select from professional voices/i);
      const step4Desc = screen.getByText(/Get your MP4, captions/i);

      expect(step1Desc).toBeDefined();
      expect(step2Desc).toBeDefined();
      expect(step3Desc).toBeDefined();
      expect(step4Desc).toBeDefined();
    });

    it('should render step numbers', () => {
      render(<Home />);

      const stepNumbers = ['Step 1', 'Step 2', 'Step 3', 'Step 4'];

      stepNumbers.forEach(stepNum => {
        const step = screen.getByText(stepNum);
        expect(step).toBeDefined();
      });
    });
  });

  describe('What You Get Section', () => {
    it('should render "Everything You Need to Start" heading', () => {
      render(<Home />);

      const heading = screen.getByText(/Everything You Need to Start/i);
      expect(heading).toBeDefined();
    });

    it('should render HD Video feature', () => {
      render(<Home />);

      const hdVideo = screen.getByText(/HD Video/i);
      const hdVideoDesc = screen.getByText(/1080p MP4 ready for YouTube/i);

      expect(hdVideo).toBeDefined();
      expect(hdVideoDesc).toBeDefined();
    });

    it('should render Pro Narration feature', () => {
      render(<Home />);

      const proNarration = screen.getByText(/Pro Narration/i);
      const narrationDesc = screen.getByText(/Natural-sounding AI voices/i);

      expect(proNarration).toBeDefined();
      expect(narrationDesc).toBeDefined();
    });

    it('should render Full Assets feature', () => {
      render(<Home />);

      const fullAssets = screen.getByText(/Full Assets/i);
      const assetsDesc = screen.getByText(/Download your script, images, audio/i);

      expect(fullAssets).toBeDefined();
      expect(assetsDesc).toBeDefined();
    });
  });

  describe('CTA Section - Acceptance Criteria: CTA', () => {
    it('should render the CTA heading', () => {
      render(<Home />);

      const ctaHeading = screen.getByText(/Ready to Create Your First Video/i);
      expect(ctaHeading).toBeDefined();
    });

    it('should render the CTA description', () => {
      render(<Home />);

      const ctaDesc = screen.getByText(/Start with 10 free minutes/i);
      expect(ctaDesc).toBeDefined();
    });

    it('should render the CTA button', () => {
      render(<Home />);

      const ctaButton = screen.getByText(/Get Started Free/i);
      expect(ctaButton).toBeDefined();

      // Check it's a link
      const ctaLink = ctaButton.closest('a');
      expect(ctaLink).toBeDefined();
      expect(ctaLink?.getAttribute('href')).toBe('/login');
    });
  });

  describe('Footer', () => {
    it('should render copyright notice', () => {
      render(<Home />);

      const currentYear = new Date().getFullYear();
      const copyright = screen.getByText(new RegExp(`© ${currentYear} CanvasCast`));
      expect(copyright).toBeDefined();
    });
  });

  describe('Overall Structure', () => {
    it('should render main element as container', () => {
      const { container } = render(<Home />);

      const main = container.querySelector('main');
      expect(main).toBeDefined();
      expect(main?.className).toContain('min-h-screen');
    });

    it('should render all major sections', () => {
      const { container } = render(<Home />);

      // Count sections (there should be multiple)
      const sections = container.querySelectorAll('section');
      expect(sections.length).toBeGreaterThanOrEqual(4); // Hero, Features, What You Get, CTA
    });

    it('should have proper responsive design classes', () => {
      const { container } = render(<Home />);

      // Check for responsive container classes
      const containers = container.querySelectorAll('.container');
      expect(containers.length).toBeGreaterThan(0);
    });
  });

  describe('Navigation Links', () => {
    it('should have working navigation links', () => {
      const { container } = render(<Home />);

      const links = container.querySelectorAll('a');
      const linkHrefs = Array.from(links).map(link => link.getAttribute('href'));

      // Check that key links exist
      expect(linkHrefs).toContain('/pricing');
      expect(linkHrefs).toContain('/login');
    });
  });
});
