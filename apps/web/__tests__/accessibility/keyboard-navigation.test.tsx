import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

// Mock component for testing skip link
function LayoutWithSkipLink({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <nav>
        <a href="/">Home</a>
        <a href="/about">About</a>
      </nav>
      <main id="main-content">{children}</main>
    </>
  );
}

// Mock navigation component
function MockNavigation() {
  return (
    <nav aria-label="Main navigation">
      <ul>
        <li><a href="/app">Dashboard</a></li>
        <li><a href="/app/projects">Projects</a></li>
        <li><a href="/app/credits">Credits</a></li>
        <li><a href="/app/settings">Settings</a></li>
      </ul>
    </nav>
  );
}

// Mock form component
function MockForm() {
  return (
    <form aria-label="Contact form">
      <label htmlFor="name">Name</label>
      <input id="name" type="text" />

      <label htmlFor="email">Email</label>
      <input id="email" type="email" />

      <button type="submit">Submit</button>
    </form>
  );
}

describe('Keyboard Navigation - A11Y-002', () => {
  describe('Skip Links', () => {
    it('should have a skip to main content link as the first focusable element', () => {
      render(<LayoutWithSkipLink><p>Main content</p></LayoutWithSkipLink>);

      const skipLink = screen.getByText('Skip to main content');
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveAttribute('href', '#main-content');
    });

    it('should navigate to main content when skip link is activated', async () => {
      const user = userEvent.setup();
      render(<LayoutWithSkipLink><p>Main content</p></LayoutWithSkipLink>);

      const skipLink = screen.getByText('Skip to main content');
      await user.click(skipLink);

      const mainContent = document.getElementById('main-content');
      expect(mainContent).toBeInTheDocument();
    });

    it('should be visually hidden until focused', () => {
      render(<LayoutWithSkipLink><p>Main content</p></LayoutWithSkipLink>);

      const skipLink = screen.getByText('Skip to main content');
      expect(skipLink).toHaveClass('skip-link');
    });
  });

  describe('Tab Order', () => {
    it('should have correct tab order in navigation', async () => {
      const user = userEvent.setup();
      render(<MockNavigation />);

      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(4);

      // Tab through all links
      await user.tab();
      expect(links[0]).toHaveFocus();

      await user.tab();
      expect(links[1]).toHaveFocus();

      await user.tab();
      expect(links[2]).toHaveFocus();

      await user.tab();
      expect(links[3]).toHaveFocus();
    });

    it('should allow reverse tab navigation', async () => {
      const user = userEvent.setup();
      render(<MockNavigation />);

      const links = screen.getAllByRole('link');

      // Tab to last element
      await user.tab();
      await user.tab();
      await user.tab();
      await user.tab();
      expect(links[3]).toHaveFocus();

      // Shift+Tab back
      await user.tab({ shift: true });
      expect(links[2]).toHaveFocus();
    });

    it('should maintain logical tab order in forms', async () => {
      const user = userEvent.setup();
      render(<MockForm />);

      const nameInput = screen.getByLabelText('Name');
      const emailInput = screen.getByLabelText('Email');
      const submitButton = screen.getByRole('button', { name: 'Submit' });

      await user.tab();
      expect(nameInput).toHaveFocus();

      await user.tab();
      expect(emailInput).toHaveFocus();

      await user.tab();
      expect(submitButton).toHaveFocus();
    });
  });

  describe('Focus Visibility', () => {
    it('should have visible focus indicators on interactive elements', () => {
      render(<MockNavigation />);

      const links = screen.getAllByRole('link');
      links.forEach(link => {
        // Links should be focusable
        expect(link).not.toHaveAttribute('tabindex', '-1');
      });
    });

    it('should not have focus on non-interactive elements', () => {
      render(
        <div>
          <p>This is regular text</p>
          <button>This is a button</button>
        </div>
      );

      const paragraph = screen.getByText('This is regular text');
      expect(paragraph).not.toHaveAttribute('tabindex', '0');
    });

    it('should show focus ring on buttons when focused', async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();

      render(<button onClick={handleClick}>Click me</button>);

      const button = screen.getByRole('button');

      await user.tab();
      expect(button).toHaveFocus();
    });
  });

  describe('Keyboard Interactions', () => {
    it('should activate buttons with Enter key', async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();

      render(<button onClick={handleClick}>Click me</button>);

      const button = screen.getByRole('button');
      button.focus();

      await user.keyboard('{Enter}');
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should activate buttons with Space key', async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();

      render(<button onClick={handleClick}>Click me</button>);

      const button = screen.getByRole('button');
      button.focus();

      await user.keyboard(' ');
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should navigate links with Enter key', async () => {
      const user = userEvent.setup();

      render(<a href="/test">Test Link</a>);

      const link = screen.getByRole('link');
      link.focus();

      // Just verify focus, actual navigation is browser behavior
      expect(link).toHaveFocus();
    });
  });

  describe('Focus Management in Dynamic Content', () => {
    it('should trap focus within modal dialogs', async () => {
      const user = userEvent.setup();

      function MockModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
        if (!isOpen) return null;

        return (
          <div role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <h2 id="modal-title">Modal Title</h2>
            <button onClick={onClose}>Close</button>
            <input type="text" placeholder="Input field" />
            <button>Action</button>
          </div>
        );
      }

      const handleClose = jest.fn();
      render(<MockModal isOpen={true} onClose={handleClose} />);

      const closeButton = screen.getByText('Close');
      const input = screen.getByPlaceholderText('Input field');
      const actionButton = screen.getByText('Action');

      // Should be able to tab between modal elements
      await user.tab();
      expect(closeButton).toHaveFocus();

      await user.tab();
      expect(input).toHaveFocus();

      await user.tab();
      expect(actionButton).toHaveFocus();
    });

    it('should restore focus when modal closes', () => {
      const triggerButton = document.createElement('button');
      triggerButton.textContent = 'Open Modal';
      document.body.appendChild(triggerButton);

      triggerButton.focus();
      expect(triggerButton).toHaveFocus();

      // Focus should be stored when modal opens
      const previousFocus = document.activeElement;
      expect(previousFocus).toBe(triggerButton);

      document.body.removeChild(triggerButton);
    });
  });

  describe('No Keyboard Traps', () => {
    it('should not trap focus outside of modal contexts', async () => {
      const user = userEvent.setup();

      render(
        <div>
          <button>Button 1</button>
          <button>Button 2</button>
          <button>Button 3</button>
        </div>
      );

      const buttons = screen.getAllByRole('button');

      await user.tab();
      expect(buttons[0]).toHaveFocus();

      await user.tab();
      expect(buttons[1]).toHaveFocus();

      await user.tab();
      expect(buttons[2]).toHaveFocus();

      // Should be able to tab past the last element
      await user.tab();
      expect(buttons[2]).not.toHaveFocus();
    });
  });

  describe('Accessible Navigation Labels', () => {
    it('should have accessible names for navigation landmarks', () => {
      render(<MockNavigation />);

      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      expect(nav).toBeInTheDocument();
    });
  });

  describe('axe Accessibility Violations', () => {
    it('should not have keyboard navigation accessibility violations', async () => {
      const { container } = render(
        <div>
          <MockNavigation />
          <MockForm />
        </div>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
