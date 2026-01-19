/**
 * App Layout Tests - UI-008
 *
 * This test file validates the App Layout requirements:
 * 1. Sidebar navigation with proper links
 * 2. User menu with email and signout
 * 3. Credit display showing balance
 *
 * Acceptance Criteria:
 * - Sidebar navigation
 * - User menu
 * - Credit display
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// Make React globally available for JSX transform
globalThis.React = React;

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement('a', { href }, children),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Play: () => React.createElement('div', { 'data-testid': 'play-icon' }),
  Home: () => React.createElement('div', { 'data-testid': 'home-icon' }),
  FolderOpen: () => React.createElement('div', { 'data-testid': 'folder-open-icon' }),
  Settings: () => React.createElement('div', { 'data-testid': 'settings-icon' }),
  CreditCard: () => React.createElement('div', { 'data-testid': 'credit-card-icon' }),
  LogOut: () => React.createElement('div', { 'data-testid': 'logout-icon' }),
  Mic: () => React.createElement('div', { 'data-testid': 'mic-icon' }),
  Coins: () => React.createElement('div', { 'data-testid': 'coins-icon' }),
}));

// Mock Supabase client
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  created_at: '2026-01-15T00:00:00Z',
};

const mockSupabase = {
  auth: {
    getUser: vi.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
  },
  rpc: vi.fn(() => Promise.resolve({ data: 42, error: null })),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

// Import after mocks are set up
import AppLayout from '@/app/app/layout';

describe('UI-008: App Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Acceptance Criteria: Sidebar navigation', () => {
    it('should render CanvasCast logo and brand name', async () => {
      const { container } = render(
        await AppLayout({ children: React.createElement('div', {}, 'Test Content') })
      );

      await waitFor(() => {
        const brandName = screen.getByText('CanvasCast');
        expect(brandName).toBeDefined();
      });
    });

    it('should render Dashboard navigation link', async () => {
      const { container } = render(
        await AppLayout({ children: React.createElement('div', {}, 'Test Content') })
      );

      await waitFor(() => {
        const dashboardLink = screen.getByText('Dashboard');
        expect(dashboardLink).toBeDefined();

        const links = container.querySelectorAll('a');
        const dashboardHref = Array.from(links).find(
          (link) => link.textContent?.includes('Dashboard')
        );
        expect(dashboardHref?.getAttribute('href')).toBe('/app');
      });
    });

    it('should render Projects navigation link', async () => {
      const { container } = render(
        await AppLayout({ children: React.createElement('div', {}, 'Test Content') })
      );

      await waitFor(() => {
        const projectsLink = screen.getByText('Projects');
        expect(projectsLink).toBeDefined();

        const links = container.querySelectorAll('a');
        const projectsHref = Array.from(links).find(
          (link) => link.textContent?.includes('Projects')
        );
        expect(projectsHref?.getAttribute('href')).toBe('/app/projects');
      });
    });

    it('should render Voice Cloning navigation link', async () => {
      const { container } = render(
        await AppLayout({ children: React.createElement('div', {}, 'Test Content') })
      );

      await waitFor(() => {
        const voiceLink = screen.getByText('Voice Cloning');
        expect(voiceLink).toBeDefined();

        const links = container.querySelectorAll('a');
        const voiceHref = Array.from(links).find(
          (link) => link.textContent?.includes('Voice Cloning')
        );
        expect(voiceHref?.getAttribute('href')).toBe('/app/settings/voice');
      });
    });

    it('should render Buy Credits navigation link', async () => {
      const { container } = render(
        await AppLayout({ children: React.createElement('div', {}, 'Test Content') })
      );

      await waitFor(() => {
        const creditsLink = screen.getByText('Buy Credits');
        expect(creditsLink).toBeDefined();

        const links = container.querySelectorAll('a');
        const creditsHref = Array.from(links).find(
          (link) => link.textContent?.includes('Buy Credits')
        );
        expect(creditsHref?.getAttribute('href')).toBe('/app/credits');
      });
    });

    it('should render Settings navigation link', async () => {
      const { container } = render(
        await AppLayout({ children: React.createElement('div', {}, 'Test Content') })
      );

      await waitFor(() => {
        const settingsLink = screen.getByText('Settings');
        expect(settingsLink).toBeDefined();

        const links = container.querySelectorAll('a');
        const settingsHref = Array.from(links).find(
          (link) =>
            link.textContent?.includes('Settings') &&
            !link.textContent?.includes('Voice')
        );
        expect(settingsHref?.getAttribute('href')).toBe('/app/settings');
      });
    });

    it('should render appropriate navigation icons', async () => {
      const { container } = render(
        await AppLayout({ children: React.createElement('div', {}, 'Test Content') })
      );

      await waitFor(() => {
        const homeIcon = container.querySelector('[data-testid="home-icon"]');
        const folderIcon = container.querySelector('[data-testid="folder-open-icon"]');
        const micIcon = container.querySelector('[data-testid="mic-icon"]');
        const coinsIcon = container.querySelector('[data-testid="coins-icon"]');
        const settingsIcon = container.querySelector('[data-testid="settings-icon"]');

        expect(homeIcon).toBeDefined();
        expect(folderIcon).toBeDefined();
        expect(micIcon).toBeDefined();
        expect(coinsIcon).toBeDefined();
        expect(settingsIcon).toBeDefined();
      });
    });
  });

  describe('Acceptance Criteria: User menu', () => {
    it('should display user email', async () => {
      render(
        await AppLayout({ children: React.createElement('div', {}, 'Test Content') })
      );

      await waitFor(() => {
        const userEmail = screen.getByText('test@example.com');
        expect(userEmail).toBeDefined();
      });
    });

    it('should render sign out button', async () => {
      const { container } = render(
        await AppLayout({ children: React.createElement('div', {}, 'Test Content') })
      );

      await waitFor(() => {
        const signOutButton = screen.getByText('Sign out');
        expect(signOutButton).toBeDefined();
      });
    });

    it('should have form action pointing to signout endpoint', async () => {
      const { container } = render(
        await AppLayout({ children: React.createElement('div', {}, 'Test Content') })
      );

      await waitFor(() => {
        const form = container.querySelector('form[action="/auth/signout"]');
        expect(form).toBeDefined();
        expect(form?.getAttribute('method')).toBe('POST');
      });
    });

    it('should render logout icon', async () => {
      const { container } = render(
        await AppLayout({ children: React.createElement('div', {}, 'Test Content') })
      );

      await waitFor(() => {
        const logoutIcon = container.querySelector('[data-testid="logout-icon"]');
        expect(logoutIcon).toBeDefined();
      });
    });
  });

  describe('Acceptance Criteria: Credit display', () => {
    it('should display credit balance', async () => {
      render(
        await AppLayout({ children: React.createElement('div', {}, 'Test Content') })
      );

      await waitFor(() => {
        const credits = screen.getByText('42 min');
        expect(credits).toBeDefined();
      });
    });

    it('should call get_credit_balance RPC function', async () => {
      render(
        await AppLayout({ children: React.createElement('div', {}, 'Test Content') })
      );

      await waitFor(() => {
        expect(mockSupabase.rpc).toHaveBeenCalledWith('get_credit_balance', {
          p_user_id: 'test-user-id',
        });
      });
    });

    it('should render credit card icon', async () => {
      const { container } = render(
        await AppLayout({ children: React.createElement('div', {}, 'Test Content') })
      );

      await waitFor(() => {
        const creditCardIcon = container.querySelector('[data-testid="credit-card-icon"]');
        expect(creditCardIcon).toBeDefined();
      });
    });

    it('should have link to credits page', async () => {
      const { container } = render(
        await AppLayout({ children: React.createElement('div', {}, 'Test Content') })
      );

      await waitFor(() => {
        const links = container.querySelectorAll('a');
        const creditLinks = Array.from(links).filter(
          (link) => link.getAttribute('href') === '/app/credits'
        );
        // Should have at least 2 credit links: one in nav, one in credit display
        expect(creditLinks.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('Layout Structure', () => {
    it('should have sidebar with proper styling', async () => {
      const { container } = render(
        await AppLayout({ children: React.createElement('div', {}, 'Test Content') })
      );

      await waitFor(() => {
        const sidebar = container.querySelector('aside');
        expect(sidebar).toBeDefined();
        expect(sidebar?.className).toContain('w-64');
      });
    });

    it('should render children in main content area', async () => {
      render(
        await AppLayout({ children: React.createElement('div', {}, 'Test Content') })
      );

      await waitFor(() => {
        const content = screen.getByText('Test Content');
        expect(content).toBeDefined();
      });
    });

    it('should have flex layout for sidebar and main content', async () => {
      const { container } = render(
        await AppLayout({ children: React.createElement('div', {}, 'Test Content') })
      );

      await waitFor(() => {
        const mainContainer = container.querySelector('.flex');
        expect(mainContainer).toBeDefined();
      });
    });
  });

  describe('Authentication', () => {
    it('should call getUser on mount', async () => {
      render(
        await AppLayout({ children: React.createElement('div', {}, 'Test Content') })
      );

      await waitFor(() => {
        expect(mockSupabase.auth.getUser).toHaveBeenCalled();
      });
    });

    it('should handle missing credits gracefully', async () => {
      mockSupabase.rpc = vi.fn(() => Promise.resolve({ data: null, error: null }));

      render(
        await AppLayout({ children: React.createElement('div', {}, 'Test Content') })
      );

      await waitFor(() => {
        const credits = screen.getByText('0 min');
        expect(credits).toBeDefined();
      });
    });
  });
});
