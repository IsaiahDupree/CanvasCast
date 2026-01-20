import { render, screen } from '@testing-library/react';
import { SkipLink } from '@/components/SkipLink';

describe('SkipLink Integration - A11Y-002', () => {
  it('should render skip link with correct attributes', () => {
    render(<SkipLink />);

    const skipLink = screen.getByText('Skip to main content');

    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute('href', '#main-content');
    expect(skipLink).toHaveClass('skip-link');
  });

  it('should have sr-only class and focus styles', () => {
    render(<SkipLink />);

    const skipLink = screen.getByText('Skip to main content');

    // Check for screen reader only class
    expect(skipLink).toHaveClass('sr-only');

    // Check for focus styles classes
    expect(skipLink.className).toContain('focus:not-sr-only');
    expect(skipLink.className).toContain('focus:absolute');
    expect(skipLink.className).toContain('focus:ring-2');
  });
});
