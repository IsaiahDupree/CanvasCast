/**
 * Resend Email Client
 *
 * Wrapper around the Resend API for sending transactional emails
 * Used for job notifications, welcome emails, and credit alerts
 */

import { Resend } from 'resend';

/**
 * Default sender configuration
 */
export const DEFAULT_FROM_NAME = 'CanvasCast';
export const DEFAULT_FROM_ADDRESS = 'noreply@canvascast.ai';
export const DEFAULT_FROM = `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_ADDRESS}>`;

/**
 * Email payload interface
 */
export interface EmailPayload {
  to: string | string[];
  from?: string;
  subject: string;
  html: string;
  text?: string;
  tags?: Array<{ name: string; value: string }>;
  replyTo?: string;
}

/**
 * Email send response
 */
export interface EmailResponse {
  id: string;
}

/**
 * Resend client wrapper class
 */
export class ResendClient {
  private resend: Resend;

  constructor(apiKey: string) {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Resend API key is required');
    }
    this.resend = new Resend(apiKey);
  }

  /**
   * Send an email via Resend
   */
  async sendEmail(payload: EmailPayload): Promise<EmailResponse> {
    const from = payload.from || DEFAULT_FROM;

    const result = await this.resend.emails.send({
      from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      tags: payload.tags,
      replyTo: payload.replyTo,
    });

    // Resend returns { data: { id: string } } or { error: Error }
    if ('error' in result && result.error) {
      throw new Error(`Failed to send email: ${result.error}`);
    }

    if (!result.data) {
      throw new Error('Failed to send email: No response data');
    }

    return { id: result.data.id };
  }

  /**
   * Get the underlying Resend instance (for advanced usage)
   */
  getClient(): Resend {
    return this.resend;
  }
}

/**
 * Create a Resend client instance
 *
 * @param apiKey - Optional API key, defaults to RESEND_API_KEY env var
 * @returns ResendClient instance
 */
export function createResendClient(apiKey?: string): ResendClient {
  const key = apiKey || process.env.RESEND_API_KEY;

  if (!key || key.trim() === '') {
    throw new Error('RESEND_API_KEY environment variable is required');
  }

  return new ResendClient(key);
}
