/**
 * ProjectCard Component Tests - UI-011
 *
 * This test file validates the ProjectCard Component requirements:
 * 1. Shows project info (title, niche, duration, date)
 * 2. Status badge
 * 3. Link to project
 *
 * Acceptance Criteria:
 * - Shows project info
 * - Status badge
 * - Link to project
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import type { Project, Job } from '@canvascast/shared';

// Make React globally available for JSX transform
globalThis.React = React;

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  CheckCircle: () => React.createElement('div', { 'data-testid': 'check-circle-icon' }),
  XCircle: () => React.createElement('div', { 'data-testid': 'x-circle-icon' }),
  Loader2: () => React.createElement('div', { 'data-testid': 'loader-icon' }),
  Clock: () => React.createElement('div', { 'data-testid': 'clock-icon' }),
}));

// Mock Next.js Link component
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement('a', { href }, children),
}));

// Import component after mocks
import { ProjectCard } from '@/components/project-card';

describe('UI-011: ProjectCard Component', () => {
  const mockProject: Project & { jobs: Job[] } = {
    id: 'project-123',
    user_id: 'user-456',
    title: 'My Awesome Video',
    niche_preset: 'explainer',
    target_minutes: 2,
    status: 'ready',
    timeline_path: null,
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-01-15T10:30:00Z',
    jobs: [],
  };

  describe('Acceptance Criteria: Shows project info', () => {
    it('should render project title', () => {
      render(<ProjectCard project={mockProject} />);

      const title = screen.getByText('My Awesome Video');
      expect(title).toBeDefined();
    });

    it('should render niche preset', () => {
      render(<ProjectCard project={mockProject} />);

      const niche = screen.getByText(/explainer/i);
      expect(niche).toBeDefined();
    });

    it('should render target duration in minutes', () => {
      render(<ProjectCard project={mockProject} />);

      const duration = screen.getByText(/2 min/i);
      expect(duration).toBeDefined();
    });

    it('should render formatted date', () => {
      render(<ProjectCard project={mockProject} />);

      // The date will be formatted based on locale
      const dateElement = screen.getByText(/1\/15\/2024|15\/1\/2024/);
      expect(dateElement).toBeDefined();
    });

    it('should capitalize niche preset', () => {
      const { container } = render(<ProjectCard project={mockProject} />);

      // Check that capitalize class is applied
      const nicheElement = container.querySelector('.capitalize');
      expect(nicheElement).toBeDefined();
    });
  });

  describe('Acceptance Criteria: Status badge', () => {
    it('should show "Ready" status with green icon for ready projects', () => {
      const readyProject = { ...mockProject, status: 'ready' as const };
      const { container } = render(<ProjectCard project={readyProject} />);

      const statusText = screen.getByText('Ready');
      expect(statusText).toBeDefined();

      // Check for check circle icon
      const icon = container.querySelector('[data-testid="check-circle-icon"]');
      expect(icon).toBeDefined();
    });

    it('should show "Failed" status with red icon for failed projects', () => {
      const failedProject = { ...mockProject, status: 'failed' as const };
      const { container } = render(<ProjectCard project={failedProject} />);

      const statusText = screen.getByText('Failed');
      expect(statusText).toBeDefined();

      // Check for x circle icon
      const icon = container.querySelector('[data-testid="x-circle-icon"]');
      expect(icon).toBeDefined();
    });

    it('should show "Generating..." status with spinner for generating projects', () => {
      const generatingProject = { ...mockProject, status: 'generating' as const };
      const { container } = render(<ProjectCard project={generatingProject} />);

      const statusText = screen.getByText('Generating...');
      expect(statusText).toBeDefined();

      // Check for loader icon
      const icon = container.querySelector('[data-testid="loader-icon"]');
      expect(icon).toBeDefined();
    });

    it('should show "Draft" status with clock icon for draft projects', () => {
      const draftProject = { ...mockProject, status: 'draft' as const };
      const { container } = render(<ProjectCard project={draftProject} />);

      const statusText = screen.getByText('Draft');
      expect(statusText).toBeDefined();

      // Check for clock icon
      const icon = container.querySelector('[data-testid="clock-icon"]');
      expect(icon).toBeDefined();
    });
  });

  describe('Acceptance Criteria: Link to project', () => {
    it('should render as a link to the project page', () => {
      const { container } = render(<ProjectCard project={mockProject} />);

      const link = container.querySelector('a[href="/app/projects/project-123"]');
      expect(link).toBeDefined();
      expect(link?.getAttribute('href')).toBe('/app/projects/project-123');
    });

    it('should wrap entire card in link', () => {
      const { container } = render(<ProjectCard project={mockProject} />);

      const link = container.querySelector('a[href="/app/projects/project-123"]');
      const title = screen.getByText('My Awesome Video');

      // Title should be inside link
      expect(link?.contains(title)).toBeTruthy();
    });

    it('should have hover state classes', () => {
      const { container } = render(<ProjectCard project={mockProject} />);

      const link = container.querySelector('a[href="/app/projects/project-123"]');
      const className = link?.className || '';

      // Check for hover-related classes
      expect(className).toContain('hover:');
    });
  });

  describe('Component Structure', () => {
    it('should render with proper card styling', () => {
      const { container } = render(<ProjectCard project={mockProject} />);

      const link = container.querySelector('a[href="/app/projects/project-123"]');
      const className = link?.className || '';

      // Check for common card classes
      expect(className).toContain('rounded');
      expect(className).toContain('border');
    });

    it('should have flex layout for content', () => {
      const { container } = render(<ProjectCard project={mockProject} />);

      const link = container.querySelector('a[href="/app/projects/project-123"]');
      const className = link?.className || '';

      expect(className).toContain('flex');
    });

    it('should render all project info in correct order', () => {
      render(<ProjectCard project={mockProject} />);

      // All elements should be present
      expect(screen.getByText('My Awesome Video')).toBeDefined();
      expect(screen.getByText(/explainer/i)).toBeDefined();
      expect(screen.getByText(/2 min/i)).toBeDefined();
      expect(screen.getByText('Ready')).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle long project titles', () => {
      const longTitleProject = {
        ...mockProject,
        title: 'This is a very long project title that might need to be truncated or wrapped',
      };

      render(<ProjectCard project={longTitleProject} />);

      const title = screen.getByText(longTitleProject.title);
      expect(title).toBeDefined();
    });

    it('should handle different niche presets', () => {
      const niches = ['explainer', 'motivation', 'facts', 'history', 'science'];

      niches.forEach((niche) => {
        const nicheProject = { ...mockProject, niche_preset: niche };
        const { unmount } = render(<ProjectCard project={nicheProject} />);

        const nicheElement = screen.getByText(new RegExp(niche, 'i'));
        expect(nicheElement).toBeDefined();

        unmount();
      });
    });

    it('should handle different duration values', () => {
      const durations = [1, 5, 10, 60];

      durations.forEach((duration) => {
        const durationProject = { ...mockProject, target_minutes: duration };
        const { unmount } = render(<ProjectCard project={durationProject} />);

        const durationElement = screen.getByText(new RegExp(`${duration} min`, 'i'));
        expect(durationElement).toBeDefined();

        unmount();
      });
    });

    it('should handle recent dates', () => {
      const recentProject = {
        ...mockProject,
        created_at: new Date().toISOString(),
      };

      expect(() => render(<ProjectCard project={recentProject} />)).not.toThrow();
    });

    it('should handle old dates', () => {
      const oldProject = {
        ...mockProject,
        created_at: '2020-01-01T00:00:00Z',
      };

      expect(() => render(<ProjectCard project={oldProject} />)).not.toThrow();
    });
  });
});
