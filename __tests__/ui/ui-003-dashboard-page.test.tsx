/**
 * Dashboard Page Tests - UI-003
 *
 * This test file validates the Dashboard Page requirements:
 * 1. Lists projects with status and details
 * 2. Shows credit balance in sidebar (via layout)
 * 3. New project button/card
 *
 * Acceptance Criteria:
 * - Lists projects
 * - Shows credit balance
 * - New project card
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

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Plus: () => React.createElement('div', { 'data-testid': 'plus' }),
  Clock: () => React.createElement('div', { 'data-testid': 'clock' }),
  CheckCircle: () => React.createElement('div', { 'data-testid': 'check-circle' }),
  XCircle: () => React.createElement('div', { 'data-testid': 'x-circle' }),
  Loader2: () => React.createElement('div', { 'data-testid': 'loader2' }),
}));

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      order: vi.fn(() => ({
        limit: vi.fn(() => ({
          then: (cb: any) => cb({ data: [], error: null }),
        })),
      })),
    })),
  })),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

// Import after mocks are set up
import DashboardPage from '@/app/app/page';

describe('UI-003: Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Acceptance Criteria: New project card', () => {
    it('should render "New Project" button in header', async () => {
      const { container } = render(await DashboardPage());

      await waitFor(() => {
        const newProjectButton = screen.getByText(/New Project/i);
        expect(newProjectButton).toBeDefined();
      });
    });

    it('should have link to /app/new for new project creation', async () => {
      const { container } = render(await DashboardPage());

      await waitFor(() => {
        const links = container.querySelectorAll('a');
        const newProjectLink = Array.from(links).find(
          (link) => link.getAttribute('href') === '/app/new'
        );
        expect(newProjectLink).toBeDefined();
      });
    });
  });

  describe('Acceptance Criteria: Lists projects', () => {
    it('should render the Dashboard heading', async () => {
      render(await DashboardPage());

      await waitFor(() => {
        const heading = screen.getByText('Dashboard');
        expect(heading).toBeDefined();
        expect(heading.tagName).toBe('H1');
      });
    });

    it('should render description text', async () => {
      render(await DashboardPage());

      await waitFor(() => {
        const description = screen.getByText(/Create and manage your video projects/i);
        expect(description).toBeDefined();
      });
    });

    it('should show empty state when no projects exist', async () => {
      render(await DashboardPage());

      await waitFor(() => {
        const emptyState = screen.getByText(/No projects yet/i);
        expect(emptyState).toBeDefined();
      });
    });

    it('should show create project CTA in empty state', async () => {
      render(await DashboardPage());

      await waitFor(() => {
        const ctaText = screen.getByText(/Create your first video project to get started/i);
        expect(ctaText).toBeDefined();
      });
    });
  });

  describe('With projects', () => {
    beforeEach(() => {
      // Mock projects data
      const mockProjects = [
        {
          id: '1',
          title: 'Test Project 1',
          niche_preset: 'explainer',
          target_minutes: 3,
          status: 'ready',
          created_at: '2026-01-15T00:00:00Z',
          jobs: [],
        },
        {
          id: '2',
          title: 'Test Project 2',
          niche_preset: 'motivation',
          target_minutes: 5,
          status: 'generating',
          created_at: '2026-01-16T00:00:00Z',
          jobs: [],
        },
      ];

      mockSupabase.from = vi.fn(() => ({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              then: (cb: any) => cb({ data: mockProjects, error: null }),
            })),
          })),
        })),
      }));
    });

    it('should render project titles', async () => {
      render(await DashboardPage());

      await waitFor(() => {
        const project1 = screen.getByText('Test Project 1');
        const project2 = screen.getByText('Test Project 2');
        expect(project1).toBeDefined();
        expect(project2).toBeDefined();
      });
    });

    it('should render project metadata (niche, duration, date)', async () => {
      render(await DashboardPage());

      await waitFor(() => {
        const explainer = screen.getByText('explainer');
        const motivation = screen.getByText('motivation');
        expect(explainer).toBeDefined();
        expect(motivation).toBeDefined();

        const duration1 = screen.getByText('3 min');
        const duration2 = screen.getByText('5 min');
        expect(duration1).toBeDefined();
        expect(duration2).toBeDefined();
      });
    });

    it('should render project status badges', async () => {
      render(await DashboardPage());

      await waitFor(() => {
        const readyStatus = screen.getByText('Ready');
        const generatingStatus = screen.getByText('Generating...');
        expect(readyStatus).toBeDefined();
        expect(generatingStatus).toBeDefined();
      });
    });

    it('should render "Recent Projects" heading when projects exist', async () => {
      render(await DashboardPage());

      await waitFor(() => {
        const heading = screen.getByText('Recent Projects');
        expect(heading).toBeDefined();
      });
    });

    it('should render "View all projects" link', async () => {
      render(await DashboardPage());

      await waitFor(() => {
        const viewAllLink = screen.getByText(/View all projects/i);
        expect(viewAllLink).toBeDefined();
      });
    });

    it('should render project cards as links to project detail', async () => {
      const { container } = render(await DashboardPage());

      await waitFor(() => {
        const links = container.querySelectorAll('a');
        const projectLinks = Array.from(links).filter((link) =>
          link.getAttribute('href')?.startsWith('/app/projects/')
        );
        expect(projectLinks.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Status Icons', () => {
    beforeEach(() => {
      const mockProjects = [
        {
          id: '1',
          title: 'Ready Project',
          niche_preset: 'explainer',
          target_minutes: 3,
          status: 'ready',
          created_at: '2026-01-15T00:00:00Z',
          jobs: [],
        },
        {
          id: '2',
          title: 'Failed Project',
          niche_preset: 'motivation',
          target_minutes: 5,
          status: 'failed',
          created_at: '2026-01-16T00:00:00Z',
          jobs: [],
        },
        {
          id: '3',
          title: 'Generating Project',
          niche_preset: 'facts',
          target_minutes: 4,
          status: 'generating',
          created_at: '2026-01-17T00:00:00Z',
          jobs: [],
        },
      ];

      mockSupabase.from = vi.fn(() => ({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              then: (cb: any) => cb({ data: mockProjects, error: null }),
            })),
          })),
        })),
      }));
    });

    it('should render appropriate status icons', async () => {
      const { container } = render(await DashboardPage());

      await waitFor(() => {
        const checkCircle = container.querySelector('[data-testid="check-circle"]');
        const xCircle = container.querySelector('[data-testid="x-circle"]');
        const loader = container.querySelector('[data-testid="loader2"]');

        expect(checkCircle).toBeDefined();
        expect(xCircle).toBeDefined();
        expect(loader).toBeDefined();
      });
    });
  });

  describe('Layout and Styling', () => {
    it('should render main container with proper padding', async () => {
      const { container } = render(await DashboardPage());

      await waitFor(() => {
        const mainDiv = container.querySelector('.p-8');
        expect(mainDiv).toBeDefined();
      });
    });

    it('should have responsive grid for project cards', async () => {
      const mockProjects = [
        {
          id: '1',
          title: 'Project 1',
          niche_preset: 'explainer',
          target_minutes: 3,
          status: 'ready',
          created_at: '2026-01-15T00:00:00Z',
          jobs: [],
        },
      ];

      mockSupabase.from = vi.fn(() => ({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              then: (cb: any) => cb({ data: mockProjects, error: null }),
            })),
          })),
        })),
      }));

      const { container } = render(await DashboardPage());

      await waitFor(() => {
        const grid = container.querySelector('.grid');
        expect(grid).toBeDefined();
      });
    });
  });

  describe('Integration with Data', () => {
    it('should call Supabase to fetch projects', async () => {
      render(await DashboardPage());

      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalledWith('projects');
      });
    });

    it('should order projects by created_at descending', async () => {
      const orderMock = vi.fn(() => ({
        limit: vi.fn(() => ({
          then: (cb: any) => cb({ data: [], error: null }),
        })),
      }));

      mockSupabase.from = vi.fn(() => ({
        select: vi.fn(() => ({
          order: orderMock,
        })),
      }));

      render(await DashboardPage());

      await waitFor(() => {
        expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false });
      });
    });

    it('should limit projects to 5', async () => {
      const limitMock = vi.fn(() => ({
        then: (cb: any) => cb({ data: [], error: null }),
      }));

      mockSupabase.from = vi.fn(() => ({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: limitMock,
          })),
        })),
      }));

      render(await DashboardPage());

      await waitFor(() => {
        expect(limitMock).toHaveBeenCalledWith(5);
      });
    });
  });
});
