import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CookieConsent } from '@/components/CookieConsent';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('CookieConsent', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should show banner on first visit', () => {
    render(<CookieConsent />);

    expect(screen.getByText(/cookies/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
  });

  it('should not show banner if consent already given', () => {
    localStorageMock.setItem('cookie-consent', JSON.stringify({
      analytics: true,
      timestamp: new Date().toISOString(),
    }));

    render(<CookieConsent />);

    expect(screen.queryByText(/cookies/i)).not.toBeInTheDocument();
  });

  it('should save accept preference when user clicks accept', async () => {
    render(<CookieConsent />);

    const acceptButton = screen.getByRole('button', { name: /accept/i });
    fireEvent.click(acceptButton);

    await waitFor(() => {
      const stored = localStorageMock.getItem('cookie-consent');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.analytics).toBe(true);
    });

    // Banner should be hidden after accepting
    expect(screen.queryByText(/cookies/i)).not.toBeInTheDocument();
  });

  it('should save reject preference when user clicks reject', async () => {
    render(<CookieConsent />);

    const rejectButton = screen.getByRole('button', { name: /reject/i });
    fireEvent.click(rejectButton);

    await waitFor(() => {
      const stored = localStorageMock.getItem('cookie-consent');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.analytics).toBe(false);
    });

    // Banner should be hidden after rejecting
    expect(screen.queryByText(/cookies/i)).not.toBeInTheDocument();
  });

  it('should provide link to privacy policy', () => {
    render(<CookieConsent />);

    const privacyLink = screen.getByRole('link', { name: /privacy policy/i });
    expect(privacyLink).toBeInTheDocument();
    expect(privacyLink).toHaveAttribute('href', '/privacy');
  });

  it('should include timestamp when saving preferences', async () => {
    render(<CookieConsent />);

    const acceptButton = screen.getByRole('button', { name: /accept/i });
    fireEvent.click(acceptButton);

    await waitFor(() => {
      const stored = localStorageMock.getItem('cookie-consent');
      const parsed = JSON.parse(stored!);
      expect(parsed.timestamp).toBeTruthy();
      expect(new Date(parsed.timestamp)).toBeInstanceOf(Date);
    });
  });

  it('should have proper ARIA labels for accessibility', () => {
    render(<CookieConsent />);

    const banner = screen.getByRole('dialog', { name: /cookie consent/i });
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute('aria-live', 'polite');
  });

  it('should show customization button for granular control', () => {
    render(<CookieConsent />);

    expect(screen.getByRole('button', { name: /customize/i })).toBeInTheDocument();
  });

  it('should allow customization of cookie preferences', async () => {
    render(<CookieConsent />);

    const customizeButton = screen.getByRole('button', { name: /customize/i });
    fireEvent.click(customizeButton);

    // Should show individual toggles
    await waitFor(() => {
      expect(screen.getByLabelText(/analytics/i)).toBeInTheDocument();
    });
  });
});
