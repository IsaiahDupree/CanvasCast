import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import SettingsPage from '../apps/web/src/app/app/settings/page';

// Set environment variables for Supabase
beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
});

// Mock Supabase client
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(),
      })),
      single: vi.fn(),
    })),
    upsert: vi.fn(),
    update: vi.fn(() => ({
      eq: vi.fn(),
    })),
  })),
};

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(() => mockSupabase),
}));

describe('SettingsPage', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };
  const mockProfile = {
    id: 'user-123',
    display_name: 'Test User',
    email: 'test@example.com',
    avatar_url: null,
  };

  const mockSubscription = {
    id: 'sub-123',
    user_id: 'user-123',
    plan: 'creator',
    status: 'active',
    credits_per_month: 100,
    cancel_at_period_end: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });
  });

  it('should render loading state initially', () => {
    render(<SettingsPage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should display profile settings section', async () => {
    mockSupabase.from.mockImplementation((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data:
              table === 'profiles'
                ? mockProfile
                : table === 'user_notification_prefs'
                ? { email_job_completed: true }
                : null,
          }),
          single: vi.fn().mockResolvedValue({
            data: table === 'subscriptions' ? mockSubscription : null,
          }),
        })),
      })),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    }));

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Profile')).toBeInTheDocument();
    });

    // Should show profile fields
    expect(screen.getByLabelText(/display name/i)).toHaveValue('Test User');
    expect(screen.getByLabelText(/email/i)).toHaveValue('test@example.com');
  });

  it('should display notification preferences section', async () => {
    const mockPrefs = {
      email_job_started: false,
      email_job_completed: true,
      email_job_failed: true,
      email_credits_low: true,
      email_account_status: true,
      marketing_opt_in: false,
    };

    mockSupabase.from.mockImplementation((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: table === 'user_notification_prefs' ? mockPrefs : null,
          }),
          single: vi.fn(),
        })),
      })),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }));

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Email Notifications/i)).toBeInTheDocument();
    });

    // Should show notification toggle switches
    expect(screen.getByText(/Job Completed/i)).toBeInTheDocument();
    expect(screen.getByText(/Job Failed/i)).toBeInTheDocument();
    expect(screen.getByText(/Credits Low/i)).toBeInTheDocument();
  });

  it('should display subscription management section when user has subscription', async () => {
    mockSupabase.from.mockImplementation((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(),
          single: vi.fn().mockResolvedValue({
            data: table === 'subscriptions' ? mockSubscription : null,
          }),
        })),
      })),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }));

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Subscription/i)).toBeInTheDocument();
    });

    // Should show subscription details
    expect(screen.getByText(/creator/i)).toBeInTheDocument();
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it('should allow updating profile settings', async () => {
    const mockUpdate = vi.fn().mockResolvedValue({ error: null });
    mockSupabase.from.mockImplementation((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: table === 'profiles' ? mockProfile : null,
          }),
          single: vi.fn(),
        })),
      })),
      update: vi.fn(() => ({
        eq: mockUpdate,
      })),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }));

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    });

    const displayNameInput = screen.getByLabelText(/display name/i);
    fireEvent.change(displayNameInput, { target: { value: 'New Name' } });

    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  it('should allow toggling notification preferences', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    mockSupabase.from.mockImplementation((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data:
              table === 'user_notification_prefs'
                ? { email_job_completed: true }
                : null,
          }),
          single: vi.fn(),
        })),
      })),
      upsert: mockUpsert,
    }));

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Email Notifications/i)).toBeInTheDocument();
    });

    // Click on a toggle
    const toggles = screen.getAllByRole('button');
    const notificationToggle = toggles.find((btn) =>
      btn.classList.contains('rounded-full')
    );
    if (notificationToggle) {
      fireEvent.click(notificationToggle);
    }

    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalled();
    });
  });

  it('should show cancel subscription button when subscription is active', async () => {
    mockSupabase.from.mockImplementation((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(),
          single: vi.fn().mockResolvedValue({
            data: table === 'subscriptions' ? mockSubscription : null,
          }),
        })),
      })),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }));

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Subscription/i)).toBeInTheDocument();
    });

    // Should show cancel button for active subscription
    expect(
      screen.getByRole('button', { name: /cancel subscription/i })
    ).toBeInTheDocument();
  });

  it('should not show subscription section when user has no subscription', async () => {
    mockSupabase.from.mockImplementation((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(),
          single: vi.fn().mockResolvedValue({ data: null }),
        })),
      })),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }));

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Settings/i)).toBeInTheDocument();
    });

    // Should not show subscription section
    expect(screen.queryByText(/cancel subscription/i)).not.toBeInTheDocument();
  });
});
