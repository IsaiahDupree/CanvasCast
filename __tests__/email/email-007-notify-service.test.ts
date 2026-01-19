/**
 * EMAIL-007: Notify Service Tests
 *
 * Tests the notification service that queues emails by type and handles user lookup.
 *
 * Acceptance Criteria:
 * - Queues emails by type (welcome, job-complete, job-failed, purchase-confirmation)
 * - Handles user lookup from Supabase
 * - Returns success/error status
 * - Validates required parameters
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Queue } from 'bullmq';

// Mock Supabase
const mockSupabaseClient = {
  from: vi.fn(),
  auth: {
    admin: {
      getUserById: vi.fn(),
    },
  },
};

// Mock BullMQ Queue
const mockEmailQueue = {
  add: vi.fn(),
} as unknown as Queue;

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

// Import after mocks
let notifyService: any;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();

  // Dynamically import to ensure mocks are applied
  const module = await import('../../apps/worker/src/notify');
  notifyService = module;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('EMAIL-007: Notify Service', () => {
  describe('Welcome Email', () => {
    it('should queue welcome email for new user', async () => {
      // Arrange
      const userId = 'user-123';
      const userEmail = 'test@example.com';
      const userName = 'Test User';

      // Mock user lookup
      mockSupabaseClient.auth.admin.getUserById.mockResolvedValue({
        data: {
          user: {
            id: userId,
            email: userEmail,
            user_metadata: {
              name: userName,
            },
          },
        },
        error: null,
      });

      mockEmailQueue.add.mockResolvedValue({ id: 'job-123' });

      // Act
      const result = await notifyService.sendWelcomeEmail(mockEmailQueue, userId);

      // Assert
      expect(result.success).toBe(true);
      expect(mockSupabaseClient.auth.admin.getUserById).toHaveBeenCalledWith(userId);
      expect(mockEmailQueue.add).toHaveBeenCalledWith(
        'welcome',
        expect.objectContaining({
          userId,
          userEmail,
          userName,
        })
      );
    });

    it('should handle missing user gracefully', async () => {
      // Arrange
      const userId = 'nonexistent-user';

      mockSupabaseClient.auth.admin.getUserById.mockResolvedValue({
        data: { user: null },
        error: { message: 'User not found' },
      });

      // Act
      const result = await notifyService.sendWelcomeEmail(mockEmailQueue, userId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('User not found');
      expect(mockEmailQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('Job Complete Email', () => {
    it('should queue job complete email with project details', async () => {
      // Arrange
      const userId = 'user-123';
      const jobId = 'job-456';
      const projectId = 'proj-789';
      const userEmail = 'test@example.com';
      const userName = 'Test User';
      const projectTitle = 'My Awesome Video';
      const duration = '1:23';
      const credits = 2;
      const downloadUrl = 'https://example.com/download/video.mp4';

      // Mock user lookup
      mockSupabaseClient.auth.admin.getUserById.mockResolvedValue({
        data: {
          user: {
            id: userId,
            email: userEmail,
            user_metadata: { name: userName },
          },
        },
        error: null,
      });

      // Mock project lookup
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: projectId,
                title: projectTitle,
              },
              error: null,
            }),
          }),
        }),
      });

      mockEmailQueue.add.mockResolvedValue({ id: 'job-123' });

      // Act
      const result = await notifyService.sendJobCompleteEmail(mockEmailQueue, {
        userId,
        jobId,
        projectId,
        projectTitle,
        duration,
        credits,
        downloadUrl,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(mockEmailQueue.add).toHaveBeenCalledWith(
        'job-complete',
        expect.objectContaining({
          userId,
          jobId,
          projectId,
          userEmail,
          userName,
          projectTitle,
          duration,
          credits,
          downloadUrl,
        })
      );
    });

    it('should validate required parameters', async () => {
      // Act
      const result = await notifyService.sendJobCompleteEmail(mockEmailQueue, {
        userId: '',
        jobId: 'job-123',
        projectId: 'proj-123',
        projectTitle: 'Test',
        duration: '1:00',
        credits: 1,
        downloadUrl: 'https://example.com/video.mp4',
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameter');
      expect(mockEmailQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('Job Failed Email', () => {
    it('should queue job failed email with error details', async () => {
      // Arrange
      const userId = 'user-123';
      const jobId = 'job-456';
      const projectId = 'proj-789';
      const projectTitle = 'Failed Video';
      const errorMessage = 'Image generation failed';
      const creditsRefunded = 2;

      mockSupabaseClient.auth.admin.getUserById.mockResolvedValue({
        data: {
          user: {
            id: userId,
            email: 'test@example.com',
            user_metadata: { name: 'Test User' },
          },
        },
        error: null,
      });

      mockEmailQueue.add.mockResolvedValue({ id: 'job-123' });

      // Act
      const result = await notifyService.sendJobFailedEmail(mockEmailQueue, {
        userId,
        jobId,
        projectId,
        projectTitle,
        errorMessage,
        creditsRefunded,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(mockEmailQueue.add).toHaveBeenCalledWith(
        'job-failed',
        expect.objectContaining({
          userId,
          jobId,
          projectTitle,
          errorMessage,
          creditsRefunded,
        })
      );
    });
  });

  describe('Purchase Confirmation Email', () => {
    it('should queue purchase confirmation email', async () => {
      // Arrange
      const userId = 'user-123';
      const creditsAdded = 50;
      const amount = 1999; // $19.99 in cents
      const receiptUrl = 'https://stripe.com/receipt/123';

      mockSupabaseClient.auth.admin.getUserById.mockResolvedValue({
        data: {
          user: {
            id: userId,
            email: 'test@example.com',
            user_metadata: { name: 'Test User' },
          },
        },
        error: null,
      });

      mockEmailQueue.add.mockResolvedValue({ id: 'job-123' });

      // Act
      const result = await notifyService.sendPurchaseConfirmationEmail(mockEmailQueue, {
        userId,
        creditsAdded,
        amount,
        receiptUrl,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(mockEmailQueue.add).toHaveBeenCalledWith(
        'purchase-confirmation',
        expect.objectContaining({
          userId,
          creditsAdded,
          amount,
          receiptUrl,
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle queue add failures', async () => {
      // Arrange
      const userId = 'user-123';

      mockSupabaseClient.auth.admin.getUserById.mockResolvedValue({
        data: {
          user: {
            id: userId,
            email: 'test@example.com',
            user_metadata: { name: 'Test User' },
          },
        },
        error: null,
      });

      mockEmailQueue.add.mockRejectedValue(new Error('Queue connection failed'));

      // Act
      const result = await notifyService.sendWelcomeEmail(mockEmailQueue, userId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Queue connection failed');
    });
  });
});
