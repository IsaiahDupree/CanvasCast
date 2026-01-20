/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RetryStepButton from '@/components/RetryStepButton';

// Mock fetch
global.fetch = jest.fn();

describe('RetryStepButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render retry button for failed step', () => {
    render(
      <RetryStepButton
        jobId="job-123"
        stepName="IMAGE_GEN"
        stepStatus="FAILED"
        stepLabel="Image Generation"
      />
    );

    expect(screen.getByText('Retry Step')).toBeInTheDocument();
  });

  it('should not render button for non-failed step', () => {
    const { container } = render(
      <RetryStepButton
        jobId="job-123"
        stepName="IMAGE_GEN"
        stepStatus="COMPLETED"
        stepLabel="Image Generation"
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should show loading state when retrying', async () => {
    (global.fetch as jest.Mock).mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => ({ success: true }),
      }), 100))
    );

    render(
      <RetryStepButton
        jobId="job-123"
        stepName="IMAGE_GEN"
        stepStatus="FAILED"
        stepLabel="Image Generation"
      />
    );

    const button = screen.getByText('Retry Step');
    fireEvent.click(button);

    expect(screen.getByText('Retrying...')).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it('should call retry API endpoint when clicked', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(
      <RetryStepButton
        jobId="job-123"
        stepName="IMAGE_GEN"
        stepStatus="FAILED"
        stepLabel="Image Generation"
      />
    );

    const button = screen.getByText('Retry Step');
    fireEvent.click(button);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/jobs/job-123/retry-step',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stepName: 'IMAGE_GEN' }),
        })
      );
    });
  });

  it('should show success message after successful retry', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Step retry started successfully'
      }),
    });

    render(
      <RetryStepButton
        jobId="job-123"
        stepName="IMAGE_GEN"
        stepStatus="FAILED"
        stepLabel="Image Generation"
      />
    );

    const button = screen.getByText('Retry Step');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Step retry started successfully')).toBeInTheDocument();
    });
  });

  it('should show error message on failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Failed to retry step' }),
    });

    render(
      <RetryStepButton
        jobId="job-123"
        stepName="IMAGE_GEN"
        stepStatus="FAILED"
        stepLabel="Image Generation"
      />
    );

    const button = screen.getByText('Retry Step');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Failed to retry step')).toBeInTheDocument();
    });
  });

  it('should call onRetrySuccess callback after successful retry', async () => {
    const mockCallback = jest.fn();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(
      <RetryStepButton
        jobId="job-123"
        stepName="IMAGE_GEN"
        stepStatus="FAILED"
        stepLabel="Image Generation"
        onRetrySuccess={mockCallback}
      />
    );

    const button = screen.getByText('Retry Step');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockCallback).toHaveBeenCalled();
    });
  });

  it('should disable retry for steps before checkpoint threshold', () => {
    render(
      <RetryStepButton
        jobId="job-123"
        stepName="SCRIPTING"
        stepStatus="FAILED"
        stepLabel="Script Generation"
      />
    );

    const button = screen.getByText('Retry Step');
    expect(button).toBeDisabled();
    expect(screen.getByText(/cannot be retried individually/i)).toBeInTheDocument();
  });
});
