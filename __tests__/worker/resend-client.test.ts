/**
 * Resend Client Tests (EMAIL-002)
 *
 * Tests for the Resend email client initialization and basic functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Resend Client (EMAIL-002)', () => {
  beforeEach(() => {
    // Clear environment variables before each test
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    // Clear any mocks
    vi.clearAllMocks();
  });

  describe('Client Initialization', () => {
    it('should create a Resend client with API key from environment', async () => {
      // Set the environment variable
      process.env.RESEND_API_KEY = 'test-api-key-123';

      const { createResendClient } = await import('../../apps/worker/src/lib/resend');
      const client = createResendClient();

      expect(client).toBeDefined();
    });

    it('should create a Resend client with provided API key', async () => {
      const { createResendClient } = await import('../../apps/worker/src/lib/resend');
      const client = createResendClient('custom-api-key-456');

      expect(client).toBeDefined();
    });

    it('should throw error when no API key is provided', async () => {
      const { createResendClient } = await import('../../apps/worker/src/lib/resend');

      expect(() => createResendClient()).toThrow('RESEND_API_KEY');
    });

    it('should throw error when API key is empty string', async () => {
      process.env.RESEND_API_KEY = '';

      const { createResendClient } = await import('../../apps/worker/src/lib/resend');

      expect(() => createResendClient()).toThrow('RESEND_API_KEY');
    });
  });

  describe('ResendClient class', () => {
    it('should initialize ResendClient with valid API key', async () => {
      const { ResendClient } = await import('../../apps/worker/src/lib/resend');
      const client = new ResendClient('test-api-key');

      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(ResendClient);
    });

    it('should throw error when ResendClient initialized without API key', async () => {
      const { ResendClient } = await import('../../apps/worker/src/lib/resend');

      expect(() => new ResendClient('')).toThrow('Resend API key is required');
    });

    it('should have sendEmail method', async () => {
      const { ResendClient } = await import('../../apps/worker/src/lib/resend');
      const client = new ResendClient('test-api-key');

      expect(client.sendEmail).toBeDefined();
      expect(typeof client.sendEmail).toBe('function');
    });
  });

  describe('Email Sending', () => {
    it('should send email with valid payload', async () => {
      const { ResendClient } = await import('../../apps/worker/src/lib/resend');
      const client = new ResendClient('test-api-key');

      // Mock the actual Resend SDK call - Resend returns { data: { id: string } }
      const mockSend = vi.fn().mockResolvedValue({
        data: { id: 'email-123' }
      });
      (client as any).resend = {
        emails: {
          send: mockSend,
        },
      };

      const result = await client.sendEmail({
        to: 'test@example.com',
        from: 'noreply@canvascast.ai',
        subject: 'Test Email',
        html: '<p>Test content</p>',
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('email-123');
      expect(mockSend).toHaveBeenCalledWith({
        to: 'test@example.com',
        from: 'noreply@canvascast.ai',
        subject: 'Test Email',
        html: '<p>Test content</p>',
        text: undefined,
        tags: undefined,
        replyTo: undefined,
      });
    });

    it('should handle email sending errors', async () => {
      const { ResendClient } = await import('../../apps/worker/src/lib/resend');
      const client = new ResendClient('test-api-key');

      // Mock the Resend SDK to throw an error
      const mockSend = vi.fn().mockRejectedValue(new Error('API Error'));
      (client as any).resend = {
        emails: {
          send: mockSend,
        },
      };

      await expect(client.sendEmail({
        to: 'test@example.com',
        from: 'noreply@canvascast.ai',
        subject: 'Test Email',
        html: '<p>Test content</p>',
      })).rejects.toThrow('API Error');
    });
  });

  describe('Configuration', () => {
    it('should export default from address', async () => {
      const { DEFAULT_FROM_ADDRESS } = await import('../../apps/worker/src/lib/resend');

      expect(DEFAULT_FROM_ADDRESS).toBeDefined();
      expect(DEFAULT_FROM_ADDRESS).toContain('@');
    });

    it('should export default from name', async () => {
      const { DEFAULT_FROM_NAME } = await import('../../apps/worker/src/lib/resend');

      expect(DEFAULT_FROM_NAME).toBeDefined();
      expect(DEFAULT_FROM_NAME).toBe('CanvasCast');
    });
  });
});
