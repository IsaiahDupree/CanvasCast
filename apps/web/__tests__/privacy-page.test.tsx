import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PrivacyPage from '@/app/privacy/page';

describe('Privacy Policy Page', () => {
  it('should render the page heading', () => {
    render(<PrivacyPage />);

    expect(screen.getByRole('heading', { level: 1, name: /privacy policy/i })).toBeInTheDocument();
  });

  it('should be comprehensive with data handling sections', () => {
    render(<PrivacyPage />);

    // Check for key sections
    expect(screen.getAllByText(/data collection/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/how we use your data/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/data retention/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/your rights/i).length).toBeGreaterThan(0);
  });

  it('should display last updated date', () => {
    render(<PrivacyPage />);

    expect(screen.getAllByText(/last updated/i).length).toBeGreaterThan(0);
    // Should contain a date pattern (e.g., "January 2026" or similar)
    expect(screen.getAllByText(/january|february|march|april|may|june|july|august|september|october|november|december/i).length).toBeGreaterThan(0);
  });

  it('should include contact information', () => {
    render(<PrivacyPage />);

    expect(screen.getAllByText(/contact/i).length).toBeGreaterThan(0);
    // Should have an email or contact link
    const contactLinks = screen.getAllByRole('link').filter(link =>
      link.getAttribute('href')?.includes('mailto:') ||
      link.textContent?.includes('@')
    );
    expect(contactLinks.length).toBeGreaterThan(0);
  });

  it('should mention GDPR and user rights', () => {
    render(<PrivacyPage />);

    expect(screen.getAllByText(/gdpr|general data protection regulation/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/right to access|data portability|deletion/i).length).toBeGreaterThan(0);
  });

  it('should have proper navigation back to home', () => {
    render(<PrivacyPage />);

    const homeLinks = screen.getAllByRole('link', { name: /canvascast/i });
    expect(homeLinks.length).toBeGreaterThan(0);
    expect(homeLinks[0]).toHaveAttribute('href', '/');
  });

  it('should describe cookie usage', () => {
    render(<PrivacyPage />);

    expect(screen.getAllByText(/cookie/i).length).toBeGreaterThan(0);
  });

  it('should mention third-party services', () => {
    render(<PrivacyPage />);

    // Should mention OpenAI, Stripe, Supabase, or similar
    expect(screen.getAllByText(/third.?party|openai|stripe|analytics/i).length).toBeGreaterThan(0);
  });

  it('should explain data security measures', () => {
    render(<PrivacyPage />);

    expect(screen.getAllByText(/security|encryption|protect/i).length).toBeGreaterThan(0);
  });

  it('should have proper semantic HTML structure', () => {
    const { container } = render(<PrivacyPage />);

    // Should use main tag for content
    const main = container.querySelector('main');
    expect(main).toBeInTheDocument();

    // Should have proper heading hierarchy
    const h2s = container.querySelectorAll('h2');
    expect(h2s.length).toBeGreaterThan(0);
  });
});
