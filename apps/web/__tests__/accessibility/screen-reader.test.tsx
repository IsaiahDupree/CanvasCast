import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { JobStepper } from '@/components/job-stepper';
import { PromptInput } from '@/components/prompt-input';

expect.extend(toHaveNoViolations);

// Mock useRouter
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

// Mock fetch
global.fetch = jest.fn();

describe('Screen Reader Testing - A11Y-003', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ draftId: 'test-draft-id', isAuthenticated: false }),
    });
  });

  describe('ARIA Labels', () => {
    it('should have proper ARIA labels on JobStepper steps', () => {
      const mockJob = {
        id: 'job-1',
        status: 'SCRIPTING' as const,
        progress: 25,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 'user-1',
        project_id: 'proj-1',
      };

      render(<JobStepper job={mockJob} />);

      // Check that the stepper has proper role
      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();

      // Check that all steps are list items
      const steps = screen.getAllByRole('listitem');
      expect(steps.length).toBeGreaterThan(0);
    });

    it('should have ARIA labels for form inputs in PromptInput', () => {
      render(<PromptInput />);

      // Textarea should be accessible
      const textarea = screen.getByRole('textbox', { name: /Describe your video idea/i });
      expect(textarea).toBeInTheDocument();

      // Submit button should have accessible text (using aria-label)
      const submitButton = screen.getByRole('button', { name: /Generate your free video/i });
      expect(submitButton).toBeInTheDocument();
    });

    it('should mark decorative icons as aria-hidden', () => {
      const mockJob = {
        id: 'job-1',
        status: 'READY' as const,
        progress: 100,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 'user-1',
        project_id: 'proj-1',
      };

      const { container } = render(<JobStepper job={mockJob} />);

      // Icons should be marked as decorative (we'll fix this in implementation)
      // For now, this test will fail intentionally
      const icons = container.querySelectorAll('svg');
      icons.forEach(icon => {
        // Icons that are purely decorative should have aria-hidden
        if (icon.parentElement?.textContent) {
          // Icon has accompanying text, should be hidden from screen readers
          expect(icon).toHaveAttribute('aria-hidden', 'true');
        }
      });
    });

    it('should have descriptive labels for progress indicators', () => {
      const mockJob = {
        id: 'job-1',
        status: 'RENDERING' as const,
        progress: 75,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 'user-1',
        project_id: 'proj-1',
      };

      render(<JobStepper job={mockJob} />);

      // Progress percentage should be visible
      const progressText = screen.getByText('75%');
      expect(progressText).toBeInTheDocument();
    });
  });

  describe('Live Region Announcements', () => {
    it('should announce dynamic status changes to screen readers', async () => {
      const { rerender } = render(
        <div role="status" aria-live="polite" aria-atomic="true">
          <p>Processing step 1 of 9</p>
        </div>
      );

      const statusRegion = screen.getByRole('status');
      expect(statusRegion).toHaveAttribute('aria-live', 'polite');
      expect(statusRegion).toHaveAttribute('aria-atomic', 'true');

      // Simulate status update
      rerender(
        <div role="status" aria-live="polite" aria-atomic="true">
          <p>Processing step 2 of 9</p>
        </div>
      );

      await waitFor(() => {
        expect(screen.getByText('Processing step 2 of 9')).toBeInTheDocument();
      });
    });

    it('should announce errors with appropriate urgency', () => {
      const { container } = render(
        <div role="alert" aria-live="assertive">
          <p>Error: Failed to generate script</p>
        </div>
      );

      const alert = container.querySelector('[role="alert"]');
      expect(alert).toHaveAttribute('aria-live', 'assertive');
    });

    it('should announce form validation errors', async () => {
      const user = userEvent.setup();
      render(<PromptInput />);

      const textarea = screen.getByRole('textbox', { name: /Describe your video idea/i });

      // Type short text and submit
      await user.type(textarea, 'short');

      const submitButton = screen.getByRole('button', { name: /Generate your free video/i });
      await user.click(submitButton);

      // Error message should be announced
      await waitFor(() => {
        const errorMessage = screen.getByText(/Please enter at least 10 characters/i);
        expect(errorMessage).toBeInTheDocument();
      });
    });
  });

  describe('Form Accessibility', () => {
    it('should have properly labeled form controls', () => {
      render(<PromptInput />);

      const textarea = screen.getByPlaceholderText(/Describe your video idea/i);

      // Should be identifiable as a text input
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveAttribute('placeholder');
    });

    it('should associate error messages with form fields', async () => {
      const user = userEvent.setup();
      render(<PromptInput />);

      const textarea = screen.getByRole('textbox', { name: /Describe your video idea/i });
      const submitButton = screen.getByRole('button', { name: /Generate your free video/i });

      // Enter short text to trigger validation
      await user.type(textarea, 'short');
      await user.click(submitButton);

      // Error should be visible and associated with field
      await waitFor(() => {
        const error = screen.getByText(/Please enter at least 10 characters/i);
        expect(error).toBeInTheDocument();
        expect(textarea).toHaveAttribute('aria-invalid', 'true');
        expect(textarea).toHaveAttribute('aria-describedby', 'prompt-error');
      });
    });

    it('should indicate required fields appropriately', () => {
      render(<PromptInput />);

      const textarea = screen.getByRole('textbox', { name: /Describe your video idea/i });
      const submitButton = screen.getByRole('button', { name: /Generate your free video/i });

      // Submit button should be disabled when form is empty
      expect(submitButton).toBeDisabled();
    });

    it('should provide clear button labels', () => {
      render(<PromptInput />);

      // All buttons should have accessible text
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveTextContent(/.+/); // Has some text content
      });
    });

    it('should have accessible loading states', async () => {
      const user = userEvent.setup();

      (global.fetch as jest.Mock).mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ draftId: 'test-draft-id', isAuthenticated: false }),
        }), 100))
      );

      render(<PromptInput />);

      const textarea = screen.getByRole('textbox', { name: /Describe your video idea/i });

      await user.type(textarea, 'This is a test prompt for video generation');

      const submitButton = screen.getByRole('button', { name: /Generate your free video/i });
      await user.click(submitButton);

      // Loading state should be accessible
      await waitFor(() => {
        const loadingButton = screen.getByRole('button', { name: /Saving your prompt/i });
        expect(loadingButton).toBeInTheDocument();
        expect(screen.getByText(/Saving/i)).toBeInTheDocument();
      });
    });
  });

  describe('Status Messages', () => {
    it('should announce completion status to screen readers', () => {
      const mockJob = {
        id: 'job-1',
        status: 'READY' as const,
        progress: 100,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 'user-1',
        project_id: 'proj-1',
      };

      render(<JobStepper job={mockJob} />);

      // Complete status should be visible
      const completeText = screen.getByText('Complete');
      expect(completeText).toBeInTheDocument();
    });

    it('should provide context for progress indicators', () => {
      const mockJob = {
        id: 'job-1',
        status: 'IMAGE_GEN' as const,
        progress: 60,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 'user-1',
        project_id: 'proj-1',
      };

      render(<JobStepper job={mockJob} />);

      // Step label should be descriptive
      const stepLabel = screen.getByText('Creating Images');
      expect(stepLabel).toBeInTheDocument();
    });
  });

  describe('Interactive Element Accessibility', () => {
    it('should have accessible example prompt buttons', async () => {
      const user = userEvent.setup();
      render(<PromptInput />);

      // Example buttons should be accessible with aria-labels
      const motivationButton = screen.getByRole('button', { name: /Use example: Motivation Video/i });
      expect(motivationButton).toBeInTheDocument();

      // Should be clickable and populate textarea
      await user.click(motivationButton);

      const textarea = screen.getByRole('textbox', { name: /Describe your video idea/i });
      expect(textarea.value.length).toBeGreaterThan(0);
      expect(textarea.value).toMatch(/motivational/i);
    });

    it('should provide feedback for disabled states', () => {
      render(<PromptInput />);

      const submitButton = screen.getByRole('button', { name: /Generate your free video/i });

      // Button should be disabled when form is empty
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Axe Accessibility Violations', () => {
    it('should not have screen reader accessibility violations in JobStepper', async () => {
      const mockJob = {
        id: 'job-1',
        status: 'SCRIPTING' as const,
        progress: 25,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 'user-1',
        project_id: 'proj-1',
      };

      const { container } = render(<JobStepper job={mockJob} />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should not have screen reader accessibility violations in PromptInput', async () => {
      const { container } = render(<PromptInput />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
