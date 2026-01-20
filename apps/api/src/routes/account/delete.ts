/**
 * Account Deletion Routes
 * For GDPR-002: Account Deletion feature
 *
 * Endpoints:
 * - POST /api/v1/account/delete - Request account deletion
 * - POST /api/v1/account/cancel-deletion - Cancel pending deletion
 * - GET /api/v1/account/deletion-status - Get deletion status
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const router = Router();

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// Validation schemas
const deletionRequestSchema = z.object({
  confirmation: z.string().refine((val) => val === 'DELETE', {
    message: 'Confirmation must be exactly "DELETE"',
  }),
  reason: z.string().optional(),
});

// Auth middleware interface
interface AuthenticatedRequest extends Request {
  user?: { id: string; email?: string };
}

/**
 * POST /api/v1/account/delete
 * Request account deletion
 */
router.post('/delete', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate request body
    const validation = deletionRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: validation.error.errors[0].message || 'Invalid request',
        details: validation.error.errors,
      });
    }

    const { confirmation, reason } = validation.data;

    // Call RPC function to request deletion
    const { data, error } = await supabase.rpc('request_account_deletion', {
      p_user_id: user.id,
      p_reason: reason || null,
    });

    if (error) {
      console.error('[ACCOUNT-DELETE] Error requesting deletion:', error);
      return res.status(500).json({ error: 'Failed to request account deletion' });
    }

    if (!data || data.length === 0) {
      return res.status(500).json({ error: 'Failed to request account deletion' });
    }

    const result = data[0];

    if (!result.success) {
      return res.status(400).json({ error: result.message || 'Deletion request already pending' });
    }

    console.log(`[ACCOUNT-DELETE] User ${user.id} requested account deletion`);

    // TODO: Queue confirmation email
    // await emailQueue.add('deletion-confirmation', {
    //   userId: user.id,
    //   scheduledDate: result.scheduled_date,
    // });

    return res.status(200).json({
      success: true,
      message: result.message,
      scheduled_deletion_date: result.scheduled_date,
    });
  } catch (error) {
    console.error('[ACCOUNT-DELETE] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/account/cancel-deletion
 * Cancel pending account deletion
 */
router.post('/cancel-deletion', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Call RPC function to cancel deletion
    const { data, error } = await supabase.rpc('cancel_account_deletion', {
      p_user_id: user.id,
    });

    if (error) {
      console.error('[ACCOUNT-DELETE] Error cancelling deletion:', error);
      return res.status(500).json({ error: 'Failed to cancel account deletion' });
    }

    if (!data || data.length === 0) {
      return res.status(500).json({ error: 'Failed to cancel account deletion' });
    }

    const result = data[0];

    if (!result.success) {
      return res.status(404).json({ error: result.message || 'No pending deletion request found' });
    }

    console.log(`[ACCOUNT-DELETE] User ${user.id} cancelled account deletion`);

    // TODO: Queue cancellation confirmation email
    // await emailQueue.add('deletion-cancelled', {
    //   userId: user.id,
    // });

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('[ACCOUNT-DELETE] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/account/deletion-status
 * Get account deletion status
 */
router.get('/deletion-status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Call RPC function to get deletion status
    const { data, error } = await supabase.rpc('get_account_deletion_status', {
      p_user_id: user.id,
    });

    if (error) {
      console.error('[ACCOUNT-DELETE] Error getting deletion status:', error);
      return res.status(500).json({ error: 'Failed to get deletion status' });
    }

    if (!data || data.length === 0) {
      return res.status(200).json({
        has_pending_deletion: false,
        scheduled_date: null,
        can_cancel: false,
      });
    }

    const status = data[0];

    return res.status(200).json({
      has_pending_deletion: status.has_pending_deletion,
      scheduled_date: status.scheduled_date,
      can_cancel: status.can_cancel,
      requested_at: status.requested_at,
      reason: status.reason,
    });
  } catch (error) {
    console.error('[ACCOUNT-DELETE] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
