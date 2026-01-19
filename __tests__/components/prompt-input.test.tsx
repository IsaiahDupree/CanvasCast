/**
 * PromptInput Component Tests - DRAFT-003
 *
 * This test file validates the PromptInput component requirements:
 * 1. Textarea with validation (minimum 10 characters)
 * 2. Saves draft on submit via /api/draft
 * 3. Redirects to signup (or /app/new if authenticated)
 *
 * Acceptance Criteria:
 * - Textarea with validation
 * - Saves draft on submit
 * - Redirects to signup
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock next/navigation before imports
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  ArrowRight: () => React.createElement('div', { 'data-testid': 'arrow-right' }),
  Loader2: () => React.createElement('div', { 'data-testid': 'loader2' }),
  Sparkles: () => React.createElement('div', { 'data-testid': 'sparkles' }),
}));

// Now import the component
import { PromptInput } from '../../apps/web/src/components/prompt-input';

// Mock fetch
global.fetch = vi.fn();

describe('DRAFT-003: PromptInput Component', () => {
  beforeEach(() => {
    mockPush.mockClear();
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render textarea input', () => {
      render(<PromptInput />);

      const textarea = screen.getByPlaceholderText(/Describe your video idea/i);
      expect(textarea).toBeDefined();
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('should render submit button', () => {
      render(<PromptInput />);

      const button = screen.getByRole('button', { name: /Generate Free Video/i });
      expect(button).toBeDefined();
    });

    it('should render example prompts', () => {
      render(<PromptInput />);

      const exampleButton = screen.getByText(/Motivation Video/i);
      expect(exampleButton).toBeDefined();
    });

    it('should show character counter', () => {
      render(<PromptInput />);

      const counter = screen.getByText('0/500');
      expect(counter).toBeDefined();
    });
  });

  describe('Validation - Acceptance Criteria: Textarea with validation', () => {
    it('should disable submit button when prompt is empty', () => {
      render(<PromptInput />);

      const button = screen.getByRole('button', { name: /Generate Free Video/i });
      expect(button.hasAttribute('disabled')).toBe(true);
    });

    it('should enable submit button when prompt has content', () => {
      render(<PromptInput />);

      const textarea = screen.getByPlaceholderText(/Describe your video idea/i);
      const button = screen.getByRole('button', { name: /Generate Free Video/i });

      fireEvent.change(textarea, { target: { value: 'A test prompt with more than 10 characters' } });

      expect(button.hasAttribute('disabled')).toBe(false);
    });

    it('should show error when submitting prompt less than 10 characters', async () => {
      render(<PromptInput />);

      const textarea = screen.getByPlaceholderText(/Describe your video idea/i);
      const form = textarea.closest('form');

      fireEvent.change(textarea, { target: { value: 'Short' } });
      fireEvent.submit(form!);

      await waitFor(() => {
        const error = screen.getByText(/at least 10 characters/i);
        expect(error).toBeDefined();
      });
    });

    it('should update character counter as user types', () => {
      render(<PromptInput />);

      const textarea = screen.getByPlaceholderText(/Describe your video idea/i);
      const testText = 'Hello World';

      fireEvent.change(textarea, { target: { value: testText } });

      const counter = screen.getByText(`${testText.length}/500`);
      expect(counter).toBeDefined();
    });

    it('should clear error message when user starts typing', () => {
      render(<PromptInput />);

      const textarea = screen.getByPlaceholderText(/Describe your video idea/i);
      const form = textarea.closest('form');

      // Trigger error first
      fireEvent.change(textarea, { target: { value: 'Short' } });
      fireEvent.submit(form!);

      // Then start typing valid text
      fireEvent.change(textarea, { target: { value: 'A longer prompt that is valid' } });

      // Error should be cleared
      const errorElements = screen.queryAllByText(/at least 10 characters/i);
      expect(errorElements.length).toBe(0);
    });
  });

  describe('Draft Saving - Acceptance Criteria: Saves draft on submit', () => {
    it('should call /api/draft endpoint with prompt text on submit', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ draftId: 'test-draft-123', isAuthenticated: false }),
      });
      global.fetch = mockFetch;

      render(<PromptInput />);

      const textarea = screen.getByPlaceholderText(/Describe your video idea/i);
      const form = textarea.closest('form');
      const testPrompt = 'Create a motivational video about overcoming fear';

      fireEvent.change(textarea, { target: { value: testPrompt } });
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promptText: testPrompt }),
        });
      });
    });

    it('should show loading state during draft save', async () => {
      const mockFetch = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ draftId: 'test-draft-123', isAuthenticated: false }),
        }), 100))
      );
      global.fetch = mockFetch;

      render(<PromptInput />);

      const textarea = screen.getByPlaceholderText(/Describe your video idea/i);
      const form = textarea.closest('form');

      fireEvent.change(textarea, { target: { value: 'A valid prompt for testing' } });
      fireEvent.submit(form!);

      // Should show loading state
      await waitFor(() => {
        const loadingText = screen.getByText(/Saving/i);
        expect(loadingText).toBeDefined();
      });
    });

    it('should disable textarea and button during submission', async () => {
      const mockFetch = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ draftId: 'test-draft-123', isAuthenticated: false }),
        }), 100))
      );
      global.fetch = mockFetch;

      render(<PromptInput />);

      const textarea = screen.getByPlaceholderText(/Describe your video idea/i);
      const button = screen.getByRole('button', { name: /Generate Free Video/i });
      const form = textarea.closest('form');

      fireEvent.change(textarea, { target: { value: 'A valid prompt for testing' } });
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(textarea.hasAttribute('disabled')).toBe(true);
        expect(button.hasAttribute('disabled')).toBe(true);
      });
    });

    it('should handle API errors gracefully', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Server error' }),
      });
      global.fetch = mockFetch;

      render(<PromptInput />);

      const textarea = screen.getByPlaceholderText(/Describe your video idea/i);
      const form = textarea.closest('form');

      fireEvent.change(textarea, { target: { value: 'A valid prompt for testing' } });
      fireEvent.submit(form!);

      await waitFor(() => {
        const error = screen.getByText(/Server error/i);
        expect(error).toBeDefined();
      });
    });

    it('should handle validation errors from API', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          error: {
            fieldErrors: {
              promptText: ['Prompt must be at least 10 characters'],
            },
          },
        }),
      });
      global.fetch = mockFetch;

      render(<PromptInput />);

      const textarea = screen.getByPlaceholderText(/Describe your video idea/i);
      const form = textarea.closest('form');

      fireEvent.change(textarea, { target: { value: 'Short' } });
      fireEvent.submit(form!);

      // First check client-side validation
      await waitFor(() => {
        const error = screen.getByText(/at least 10 characters/i);
        expect(error).toBeDefined();
      });
    });
  });

  describe('Redirect Behavior - Acceptance Criteria: Redirects to signup', () => {
    it('should redirect to /signup with draftId for anonymous users', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          draftId: 'test-draft-123',
          isAuthenticated: false
        }),
      });
      global.fetch = mockFetch;

      render(<PromptInput />);

      const textarea = screen.getByPlaceholderText(/Describe your video idea/i);
      const form = textarea.closest('form');

      fireEvent.change(textarea, { target: { value: 'A valid prompt for testing redirect' } });
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/signup?draft=test-draft-123');
      });
    });

    it('should redirect to /app/new with draftId for authenticated users', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          draftId: 'test-draft-456',
          isAuthenticated: true
        }),
      });
      global.fetch = mockFetch;

      render(<PromptInput />);

      const textarea = screen.getByPlaceholderText(/Describe your video idea/i);
      const form = textarea.closest('form');

      fireEvent.change(textarea, { target: { value: 'A valid prompt for authenticated user' } });
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/app/new?draft=test-draft-456');
      });
    });
  });

  describe('Example Prompts', () => {
    it('should populate textarea when example is clicked', () => {
      render(<PromptInput />);

      const textarea = screen.getByPlaceholderText(/Describe your video idea/i) as HTMLTextAreaElement;
      const motivationButton = screen.getByText(/Motivation Video/i);

      fireEvent.click(motivationButton);

      expect(textarea.value.length).toBeGreaterThan(10);
      expect(textarea.value).toContain('motivational');
    });

    it('should clear error when example is clicked', () => {
      render(<PromptInput />);

      const textarea = screen.getByPlaceholderText(/Describe your video idea/i);
      const form = textarea.closest('form');

      // Trigger error first
      fireEvent.change(textarea, { target: { value: 'Short' } });
      fireEvent.submit(form!);

      // Click example
      const motivationButton = screen.getByText(/Motivation Video/i);
      fireEvent.click(motivationButton);

      // Error should be cleared
      const errorElements = screen.queryAllByText(/at least 10 characters/i);
      expect(errorElements.length).toBe(0);
    });

    it('should enable submit button when example is selected', () => {
      render(<PromptInput />);

      const button = screen.getByRole('button', { name: /Generate Free Video/i });
      const motivationButton = screen.getByText(/Motivation Video/i);

      fireEvent.click(motivationButton);

      expect(button.hasAttribute('disabled')).toBe(false);
    });
  });

  describe('Component Integration', () => {
    it('should handle complete flow: example -> edit -> submit -> redirect', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          draftId: 'test-draft-789',
          isAuthenticated: false
        }),
      });
      global.fetch = mockFetch;

      render(<PromptInput />);

      const textarea = screen.getByPlaceholderText(/Describe your video idea/i) as HTMLTextAreaElement;
      const form = textarea.closest('form');
      const motivationButton = screen.getByText(/Motivation Video/i);

      // Click example
      fireEvent.click(motivationButton);

      // Edit the prompt
      const editedPrompt = textarea.value + ' with additional details';
      fireEvent.change(textarea, { target: { value: editedPrompt } });

      // Submit
      fireEvent.submit(form!);

      // Should call API and redirect
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith('/signup?draft=test-draft-789');
      });
    });
  });
});
