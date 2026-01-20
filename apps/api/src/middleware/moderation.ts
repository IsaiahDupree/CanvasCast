/**
 * Content Moderation Middleware (MOD-001)
 *
 * Express middleware that filters prompts for prohibited content
 * before job creation using OpenAI's moderation API
 */

import { Request, Response, NextFunction } from 'express';
import { moderatePrompt } from '@canvascast/shared';
import { logPromptSubmitted, logPromptBlocked } from '../services/audit-log';

/**
 * Express request with typed body for project creation
 */
interface ProjectCreationRequest extends Request {
  body: {
    content?: string;
    title?: string;
    [key: string]: any;
  };
  user?: {
    id: string;
    [key: string]: any;
  };
}

/**
 * Middleware to moderate content before processing
 *
 * This middleware:
 * 1. Extracts the content/prompt from the request body
 * 2. Calls the moderation API to check for policy violations
 * 3. Blocks requests with prohibited content
 * 4. Allows safe content to proceed to the next middleware
 *
 * Usage:
 * app.post('/api/v1/projects', authenticateToken, moderateContent, async (req, res) => {
 *   // ... create project
 * });
 */
export async function moderateContent(
  req: ProjectCreationRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract content to moderate (could be from 'content' or 'title' field)
    const { content, title } = req.body;

    // Combine content and title for moderation
    const textToModerate = [content, title].filter(Boolean).join(' ');

    if (!textToModerate || textToModerate.trim().length === 0) {
      res.status(400).json({
        error: 'No content provided',
        message: 'Please provide content or title for your project',
      });
      return;
    }

    // Call moderation API
    const result = await moderatePrompt(textToModerate);

    // Get user ID for audit logging
    const userId = req.user?.id || 'anonymous';

    // Extract metadata for audit log
    const metadata = {
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string,
    };

    // If content is not allowed, reject the request
    if (!result.allowed) {
      console.warn('[MODERATION] Blocked content:', {
        reason: result.reason,
        categories: result.categories,
        contentLength: textToModerate.length,
      });

      // Log blocked prompt to audit trail (MOD-003)
      await logPromptBlocked(userId, textToModerate, result, metadata);

      res.status(400).json({
        error: 'Content moderation failed',
        message: result.reason || 'Your content violates our content policy',
        categories: result.categories,
      });
      return;
    }

    // Content is safe, log to audit trail (MOD-003)
    await logPromptSubmitted(userId, textToModerate, result, metadata);

    // Content is safe, proceed to next middleware
    console.log('[MODERATION] Content approved, proceeding with request');
    next();
  } catch (error: any) {
    console.error('[MODERATION] Error during content moderation:', error);

    // In production, fail closed (reject on error)
    // In development, log warning and allow
    if (process.env.NODE_ENV === 'production') {
      res.status(500).json({
        error: 'Content moderation service unavailable',
        message: 'Unable to verify content safety. Please try again later.',
      });
    } else {
      console.warn('[MODERATION] Allowing content due to moderation error in non-production environment');
      next();
    }
  }
}

/**
 * Optional middleware for moderating only the title field
 */
export async function moderateTitle(
  req: ProjectCreationRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { title } = req.body;

    if (!title || title.trim().length === 0) {
      res.status(400).json({
        error: 'No title provided',
        message: 'Please provide a title for your project',
      });
      return;
    }

    const result = await moderatePrompt(title);

    // Get user ID for audit logging
    const userId = req.user?.id || 'anonymous';

    // Extract metadata for audit log
    const metadata = {
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string,
    };

    if (!result.allowed) {
      // Log blocked title to audit trail (MOD-003)
      await logPromptBlocked(userId, title, result, metadata);

      res.status(400).json({
        error: 'Title moderation failed',
        message: result.reason || 'Your title violates our content policy',
        categories: result.categories,
      });
      return;
    }

    // Log approved title to audit trail (MOD-003)
    await logPromptSubmitted(userId, title, result, metadata);

    next();
  } catch (error: any) {
    console.error('[MODERATION] Error during title moderation:', error);

    if (process.env.NODE_ENV === 'production') {
      res.status(500).json({
        error: 'Content moderation service unavailable',
        message: 'Unable to verify content safety. Please try again later.',
      });
    } else {
      next();
    }
  }
}
