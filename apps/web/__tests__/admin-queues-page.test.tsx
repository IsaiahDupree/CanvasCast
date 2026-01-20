/**
 * Admin Queue Health Dashboard UI Tests
 * ADMIN-004: Queue Health Dashboard
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock the page component
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({
          data: {
            session: {
              access_token: 'test-token',
            },
          },
        })
      ),
    },
  })),
}));

describe('Queue Health Dashboard Page', () => {
  it('should render queue statistics', async () => {
    // Mock fetch response
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            queues: [
              {
                name: 'video-generation',
                waiting: 5,
                active: 2,
                completed: 100,
                failed: 3,
                delayed: 0,
                isPaused: false,
              },
            ],
            stuckJobs: [],
            workers: {
              active: 2,
            },
          }),
      } as Response)
    ) as any;

    // Import the page component dynamically
    const QueuesPage = (await import('@/app/admin/queues/page')).default;

    render(<QueuesPage />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    // Check for queue stats display
    expect(screen.getByText(/queue health/i)).toBeInTheDocument();
  });

  it('should display stuck jobs when present', async () => {
    const stuckJobDuration = 45 * 60 * 1000; // 45 minutes
    const stuckJob = {
      id: 'stuck-job-123',
      name: 'video-generation',
      timestamp: Date.now() - stuckJobDuration,
      duration: stuckJobDuration,
    };

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            queues: [
              {
                name: 'video-generation',
                waiting: 5,
                active: 1,
                completed: 100,
                failed: 3,
                delayed: 0,
                isPaused: false,
              },
            ],
            stuckJobs: [stuckJob],
            workers: {
              active: 1,
            },
          }),
      } as Response)
    ) as any;

    const QueuesPage = (await import('@/app/admin/queues/page')).default;

    render(<QueuesPage />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    // Should show stuck jobs section
    expect(screen.getByText(/stuck job/i)).toBeInTheDocument();
  });

  it('should show error message on API failure', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal server error' }),
      } as Response)
    ) as any;

    const QueuesPage = (await import('@/app/admin/queues/page')).default;

    render(<QueuesPage />);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
