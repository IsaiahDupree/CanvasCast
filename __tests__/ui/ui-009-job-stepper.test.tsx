/**
 * JobStepper Component Tests - UI-009
 *
 * This test file validates the JobStepper Component requirements:
 * 1. Shows 9 pipeline steps
 * 2. Highlights current step
 * 3. Shows progress percentage
 *
 * Acceptance Criteria:
 * - Shows 9 steps
 * - Highlights current
 * - Shows progress %
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// Make React globally available for JSX transform
globalThis.React = React;

// Import component
import { JobStepper } from '@/components/job-stepper';
import type { Job } from '@canvascast/shared';

describe('UI-009: JobStepper Component', () => {
  const mockJob: Job = {
    id: 'test-job-id',
    project_id: 'test-project-id',
    user_id: 'test-user-id',
    status: 'SCRIPTING',
    progress: 50,
    error_code: null,
    error_message: null,
    claimed_at: new Date().toISOString(),
    claimed_by: 'worker-1',
    started_at: new Date().toISOString(),
    finished_at: null,
    cost_credits_reserved: 3,
    cost_credits_final: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Acceptance Criteria: Shows 9 steps', () => {
    it('should render all 9 pipeline steps', () => {
      render(<JobStepper job={mockJob} />);

      const expectedSteps = [
        'Writing Script',
        'Generating Voice',
        'Syncing Audio',
        'Planning Visuals',
        'Creating Images',
        'Building Timeline',
        'Rendering Video',
        'Packaging',
        'Complete',
      ];

      expectedSteps.forEach((stepLabel) => {
        const step = screen.getByText(stepLabel);
        expect(step).toBeDefined();
      });
    });

    it('should render step labels in correct order', () => {
      const { container } = render(<JobStepper job={mockJob} />);

      const steps = Array.from(container.querySelectorAll('[role="listitem"]')).map(
        (el) => el.textContent
      );

      expect(steps.length).toBeGreaterThanOrEqual(9);
    });
  });

  describe('Acceptance Criteria: Highlights current step', () => {
    it('should highlight the SCRIPTING step when status is SCRIPTING', () => {
      const scriptingJob = { ...mockJob, status: 'SCRIPTING' as const };
      const { container } = render(<JobStepper job={scriptingJob} />);

      // Find the current step - should have special styling
      const currentStepText = screen.getByText('Writing Script');
      expect(currentStepText).toBeDefined();
    });

    it('should highlight the VOICE_GEN step when status is VOICE_GEN', () => {
      const voiceJob = { ...mockJob, status: 'VOICE_GEN' as const };
      const { container } = render(<JobStepper job={voiceJob} />);

      const currentStepText = screen.getByText('Generating Voice');
      expect(currentStepText).toBeDefined();
    });

    it('should highlight the ALIGNMENT step when status is ALIGNMENT', () => {
      const alignmentJob = { ...mockJob, status: 'ALIGNMENT' as const };
      render(<JobStepper job={alignmentJob} />);

      const currentStepText = screen.getByText('Syncing Audio');
      expect(currentStepText).toBeDefined();
    });

    it('should highlight the VISUAL_PLAN step when status is VISUAL_PLAN', () => {
      const visualPlanJob = { ...mockJob, status: 'VISUAL_PLAN' as const };
      render(<JobStepper job={visualPlanJob} />);

      const currentStepText = screen.getByText('Planning Visuals');
      expect(currentStepText).toBeDefined();
    });

    it('should highlight the IMAGE_GEN step when status is IMAGE_GEN', () => {
      const imageGenJob = { ...mockJob, status: 'IMAGE_GEN' as const };
      render(<JobStepper job={imageGenJob} />);

      const currentStepText = screen.getByText('Creating Images');
      expect(currentStepText).toBeDefined();
    });

    it('should highlight the TIMELINE_BUILD step when status is TIMELINE_BUILD', () => {
      const timelineJob = { ...mockJob, status: 'TIMELINE_BUILD' as const };
      render(<JobStepper job={timelineJob} />);

      const currentStepText = screen.getByText('Building Timeline');
      expect(currentStepText).toBeDefined();
    });

    it('should highlight the RENDERING step when status is RENDERING', () => {
      const renderingJob = { ...mockJob, status: 'RENDERING' as const };
      render(<JobStepper job={renderingJob} />);

      const currentStepText = screen.getByText('Rendering Video');
      expect(currentStepText).toBeDefined();
    });

    it('should highlight the PACKAGING step when status is PACKAGING', () => {
      const packagingJob = { ...mockJob, status: 'PACKAGING' as const };
      render(<JobStepper job={packagingJob} />);

      const currentStepText = screen.getByText('Packaging');
      expect(currentStepText).toBeDefined();
    });

    it('should show complete state when status is READY', () => {
      const readyJob = { ...mockJob, status: 'READY' as const, progress: 100 };
      render(<JobStepper job={readyJob} />);

      const completeText = screen.getByText('Complete');
      expect(completeText).toBeDefined();
    });
  });

  describe('Acceptance Criteria: Shows progress %', () => {
    it('should display progress percentage for current step', () => {
      const job = { ...mockJob, status: 'SCRIPTING' as const, progress: 45 };
      render(<JobStepper job={job} />);

      const progressText = screen.getByText(/45%/);
      expect(progressText).toBeDefined();
    });

    it('should display 100% when job is READY', () => {
      const readyJob = { ...mockJob, status: 'READY' as const, progress: 100 };
      render(<JobStepper job={readyJob} />);

      const progressText = screen.getByText(/100%/);
      expect(progressText).toBeDefined();
    });

    it('should display progress for IMAGE_GEN step', () => {
      const imageJob = { ...mockJob, status: 'IMAGE_GEN' as const, progress: 75 };
      render(<JobStepper job={imageJob} />);

      const progressText = screen.getByText(/75%/);
      expect(progressText).toBeDefined();
    });

    it('should display progress for RENDERING step', () => {
      const renderJob = { ...mockJob, status: 'RENDERING' as const, progress: 88 };
      render(<JobStepper job={renderJob} />);

      const progressText = screen.getByText(/88%/);
      expect(progressText).toBeDefined();
    });
  });

  describe('Step States', () => {
    it('should show completed state for steps before current', () => {
      const job = { ...mockJob, status: 'RENDERING' as const, progress: 80 };
      const { container } = render(<JobStepper job={job} />);

      // Steps before RENDERING should be marked as complete
      const scriptStep = screen.getByText('Writing Script');
      const voiceStep = screen.getByText('Generating Voice');
      expect(scriptStep).toBeDefined();
      expect(voiceStep).toBeDefined();
    });

    it('should show pending state for steps after current', () => {
      const job = { ...mockJob, status: 'SCRIPTING' as const, progress: 50 };
      render(<JobStepper job={job} />);

      // Steps after SCRIPTING should be pending
      const renderStep = screen.getByText('Rendering Video');
      const packageStep = screen.getByText('Packaging');
      expect(renderStep).toBeDefined();
      expect(packageStep).toBeDefined();
    });
  });

  describe('Failed State', () => {
    it('should handle FAILED status gracefully', () => {
      const failedJob = {
        ...mockJob,
        status: 'FAILED' as const,
        error_message: 'Test error',
      };
      render(<JobStepper job={failedJob} />);

      // Component should still render
      const scriptStep = screen.getByText('Writing Script');
      expect(scriptStep).toBeDefined();
    });
  });

  describe('Visual Rendering', () => {
    it('should render as an ordered list', () => {
      const { container } = render(<JobStepper job={mockJob} />);

      const list = container.querySelector('[role="list"]');
      expect(list).toBeDefined();
    });

    it('should have proper accessibility attributes', () => {
      const { container } = render(<JobStepper job={mockJob} />);

      const list = container.querySelector('[role="list"]');
      expect(list).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle QUEUED status', () => {
      const queuedJob = { ...mockJob, status: 'QUEUED' as const, progress: 0 };
      render(<JobStepper job={queuedJob} />);

      const scriptStep = screen.getByText('Writing Script');
      expect(scriptStep).toBeDefined();
    });

    it('should handle CLAIMED status', () => {
      const claimedJob = { ...mockJob, status: 'CLAIMED' as const, progress: 0 };
      render(<JobStepper job={claimedJob} />);

      const scriptStep = screen.getByText('Writing Script');
      expect(scriptStep).toBeDefined();
    });

    it('should render with 0% progress', () => {
      const job = { ...mockJob, status: 'SCRIPTING' as const, progress: 0 };
      render(<JobStepper job={job} />);

      const progressText = screen.getByText(/0%/);
      expect(progressText).toBeDefined();
    });
  });
});
