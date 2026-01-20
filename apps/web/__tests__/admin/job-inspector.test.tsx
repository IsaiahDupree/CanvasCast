/**
 * @jest-environment jsdom
 */
/**
 * Tests for Admin Job Inspector (ADMIN-002)
 *
 * Acceptance criteria:
 * - Job details visible
 * - Step logs shown
 * - Artifacts downloadable
 */

import { render, screen, waitFor } from '@testing-library/react';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'test-job-123' }),
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
}));

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'admin-user-id' } },
        error: null,
      }),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          is_admin: true,
          email: 'admin@test.com',
        },
        error: null,
      }),
    })),
  }),
}));

describe('Admin Job Inspector', () => {
  beforeEach(() => {
    // Mock fetch for job data
    global.fetch = jest.fn((url: string) => {
      if (url.includes('/api/admin/jobs/')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            jobId: 'test-job-123',
            projectId: 'test-project-456',
            userId: 'user-789',
            status: 'RENDERING',
            progress: 75,
            errorCode: null,
            errorMessage: null,
            claimedAt: '2024-01-20T10:00:00Z',
            claimedBy: 'worker-1',
            startedAt: '2024-01-20T10:00:10Z',
            finishedAt: null,
            costCreditsReserved: 5,
            costCreditsFinal: null,
            createdAt: '2024-01-20T09:59:00Z',
            updatedAt: '2024-01-20T10:15:00Z',
            steps: [
              {
                stepName: 'scripting',
                state: 'succeeded',
                progressPct: 100,
                statusMessage: 'Script generated successfully',
                errorMessage: null,
                startedAt: '2024-01-20T10:00:10Z',
                finishedAt: '2024-01-20T10:01:00Z',
                logsUrl: null,
                logs: ['Starting script generation', 'Generated 500 words'],
                artifacts: [],
              },
              {
                stepName: 'image_gen',
                state: 'succeeded',
                progressPct: 100,
                statusMessage: '10 images generated',
                errorMessage: null,
                startedAt: '2024-01-20T10:01:05Z',
                finishedAt: '2024-01-20T10:10:00Z',
                logsUrl: null,
                logs: ['Generating image 1/10', 'Generating image 10/10', 'All images complete'],
                artifacts: [],
              },
              {
                stepName: 'rendering',
                state: 'started',
                progressPct: 75,
                statusMessage: 'Rendering video...',
                errorMessage: null,
                startedAt: '2024-01-20T10:10:05Z',
                finishedAt: null,
                logsUrl: null,
                logs: ['Starting render', 'Frame 750/1000', 'Progress: 75%'],
                artifacts: [],
              },
            ],
            assets: [
              {
                id: 'asset-1',
                type: 'script',
                path: '/storage/scripts/test.json',
                url: 'https://storage.example.com/scripts/test.json',
                metadata: { wordCount: 500 },
              },
              {
                id: 'asset-2',
                type: 'image',
                path: '/storage/images/img1.png',
                url: 'https://storage.example.com/images/img1.png',
                metadata: { width: 1920, height: 1080 },
              },
            ],
            project: {
              id: 'test-project-456',
              title: 'Test Video',
              nichePreset: 'explainer',
            },
          }),
        } as Response);
      }
      return Promise.reject(new Error('Not found'));
    }) as typeof fetch;
  });

  it('should display job details', async () => {
    const { default: JobInspectorPage } = await import('@/app/admin/jobs/[id]/page');

    const { container } = render(<JobInspectorPage />);

    // Wait for page to load (not showing error or loading state)
    await waitFor(
      () => {
        expect(container.querySelector('.min-h-\\[60vh\\]')).toBeNull(); // Loading spinner should be gone
        // Should render the main page container
        expect(container.querySelector('.max-w-6xl')).toBeTruthy();
      },
      { timeout: 3000 }
    );

    // Check for job info elements
    await waitFor(
      () => {
        expect(screen.getByText(/Job Info/i)).toBeInTheDocument();
        expect(screen.getByText(/Worker Info/i)).toBeInTheDocument();
        expect(screen.getByText(/Credits/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('should display step logs', async () => {
    const { default: JobInspectorPage } = await import('@/app/admin/jobs/[id]/page');

    render(<JobInspectorPage />);

    await waitFor(
      () => {
        // Should show at least one step status message
        expect(screen.getByText(/Script generated successfully/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('should display downloadable artifacts', async () => {
    const { default: JobInspectorPage } = await import('@/app/admin/jobs/[id]/page');

    render(<JobInspectorPage />);

    await waitFor(
      () => {
        // Component should be loaded and showing job ID
        expect(screen.getByText(/test-job-123/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Should have download links (check using getAllByRole)
    await waitFor(
      () => {
        const links = screen.getAllByRole('link');
        expect(links.length).toBeGreaterThan(0);
      },
      { timeout: 3000 }
    );
  });

  it('should handle job not found', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Job not found' }),
      } as Response)
    ) as jest.Mock;

    const { default: JobInspectorPage } = await import('@/app/admin/jobs/[id]/page');

    render(<JobInspectorPage />);

    await waitFor(() => {
      expect(screen.getByText(/Job not found/i)).toBeInTheDocument();
    });
  });

  it('should handle unauthorized access', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Unauthorized' }),
      } as Response)
    ) as jest.Mock;

    const { default: JobInspectorPage } = await import('@/app/admin/jobs/[id]/page');

    render(<JobInspectorPage />);

    await waitFor(() => {
      expect(screen.getByText(/Unauthorized/i)).toBeInTheDocument();
    });
  });
});
