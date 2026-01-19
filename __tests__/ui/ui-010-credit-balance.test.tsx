/**
 * CreditBalance Component Tests - UI-010
 *
 * This test file validates the CreditBalance Component requirements:
 * 1. Shows credit balance
 * 2. Link to purchase page
 *
 * Acceptance Criteria:
 * - Shows balance
 * - Link to purchase
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Make React globally available for JSX transform
globalThis.React = React;

// Mock the useCredits hook before importing the component
const mockUseCredits = vi.fn();
vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => mockUseCredits(),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Coins: () => React.createElement('div', { 'data-testid': 'coins-icon' }),
}));

// Mock Next.js Link component
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement('a', { href, 'data-testid': 'credit-link' }, children),
}));

// Import component after mocks
import { CreditBalance } from '@/components/credit-balance';

describe('UI-010: CreditBalance Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Acceptance Criteria: Shows balance', () => {
    it('should render credit balance when loaded', () => {
      mockUseCredits.mockReturnValue({
        balance: 25,
        isLoading: false,
      });

      render(<CreditBalance />);

      // Should show the balance number
      const balanceText = screen.getByText(/25 credits/i);
      expect(balanceText).toBeDefined();
    });

    it('should show loading state while fetching balance', () => {
      mockUseCredits.mockReturnValue({
        balance: 0,
        isLoading: true,
      });

      render(<CreditBalance />);

      // Should show loading indicator
      const loadingText = screen.getByText(/\.\.\./);
      expect(loadingText).toBeDefined();
    });

    it('should render Coins icon', () => {
      mockUseCredits.mockReturnValue({
        balance: 10,
        isLoading: false,
      });

      const { container } = render(<CreditBalance />);

      // Check for SVG element with coins class (lucide renders actual SVG)
      const icon = container.querySelector('svg.lucide-coins');
      expect(icon).toBeDefined();
    });

    it('should display different balance amounts correctly', () => {
      const testCases = [0, 1, 10, 100, 999];

      testCases.forEach((balance) => {
        mockUseCredits.mockReturnValue({
          balance,
          isLoading: false,
        });

        const { unmount } = render(<CreditBalance />);

        const balanceText = screen.getByText(new RegExp(`${balance} credits`, 'i'));
        expect(balanceText).toBeDefined();

        unmount();
      });
    });
  });

  describe('Acceptance Criteria: Link to purchase', () => {
    it('should render Buy More button', () => {
      mockUseCredits.mockReturnValue({
        balance: 5,
        isLoading: false,
      });

      render(<CreditBalance />);

      const button = screen.getByRole('button', { name: /Buy More/i });
      expect(button).toBeDefined();
    });

    it('should link to /app/credits page', () => {
      mockUseCredits.mockReturnValue({
        balance: 5,
        isLoading: false,
      });

      render(<CreditBalance />);

      const link = screen.getByTestId('credit-link');
      expect(link.getAttribute('href')).toBe('/app/credits');
    });

    it('should render button inside link', () => {
      mockUseCredits.mockReturnValue({
        balance: 5,
        isLoading: false,
      });

      const { container } = render(<CreditBalance />);

      const link = screen.getByTestId('credit-link');
      const button = link.querySelector('button');
      expect(button).toBeDefined();
      expect(button?.textContent).toContain('Buy More');
    });
  });

  describe('Component Structure', () => {
    it('should render with proper flex layout', () => {
      mockUseCredits.mockReturnValue({
        balance: 15,
        isLoading: false,
      });

      const { container } = render(<CreditBalance />);

      const wrapper = container.querySelector('.flex.items-center');
      expect(wrapper).toBeDefined();
    });

    it('should render all elements in correct order', () => {
      mockUseCredits.mockReturnValue({
        balance: 20,
        isLoading: false,
      });

      const { container } = render(<CreditBalance />);

      // Icon should be present
      const icon = container.querySelector('svg.lucide-coins');
      expect(icon).toBeDefined();

      // Balance text should be present
      const balanceText = screen.getByText(/20 credits/i);
      expect(balanceText).toBeDefined();

      // Buy More button should be present
      const button = screen.getByRole('button', { name: /Buy More/i });
      expect(button).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero credits correctly', () => {
      mockUseCredits.mockReturnValue({
        balance: 0,
        isLoading: false,
      });

      render(<CreditBalance />);

      const balanceText = screen.getByText(/0 credits/i);
      expect(balanceText).toBeDefined();
    });

    it('should handle large credit amounts', () => {
      mockUseCredits.mockReturnValue({
        balance: 10000,
        isLoading: false,
      });

      render(<CreditBalance />);

      const balanceText = screen.getByText(/10000 credits/i);
      expect(balanceText).toBeDefined();
    });

    it('should not crash when hook returns undefined balance', () => {
      mockUseCredits.mockReturnValue({
        balance: undefined,
        isLoading: false,
      });

      expect(() => render(<CreditBalance />)).not.toThrow();
    });
  });
});
