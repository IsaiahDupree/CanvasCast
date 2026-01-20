/**
 * Appeals API Routes (MOD-004)
 *
 * Endpoints:
 * - POST /api/v1/appeals - Submit an appeal
 * - GET /api/v1/appeals - Get user's appeals or admin view all (with filters)
 * - PATCH /api/v1/appeals/:id/resolve - Resolve an appeal (admin only)
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { queueAppealDecisionEmail } from '../services/notifications.js';

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// Auth middleware types
interface AuthenticatedRequest extends Request {
  user?: { id: string; email?: string };
}

/**
 * POST /api/v1/appeals
 * Submit a new appeal for blocked content
 *
 * Body:
 * - audit_log_id: UUID (optional) - Reference to audit log entry
 * - reason: string (min 10 chars) - User's explanation
 * - original_content: string - The content that was moderated
 *
 * Returns:
 * - appeal_id: UUID
 * - status: 'pending'
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { audit_log_id, reason, original_content } = req.body;

    // Validate input
    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      return res.status(400).json({
        error: 'Reason is required and must be at least 10 characters',
      });
    }

    if (!original_content || typeof original_content !== 'string') {
      return res.status(400).json({
        error: 'Original content is required',
      });
    }

    // Get user's IP and user agent for metadata
    const metadata = {
      ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      user_agent: req.headers['user-agent'] || 'unknown',
    };

    // Call the submit_appeal function
    const { data, error } = await supabase.rpc('submit_appeal', {
      p_user_id: userId,
      p_audit_log_id: audit_log_id || null,
      p_reason: reason.trim(),
      p_original_content: original_content.trim(),
      p_metadata: metadata,
    });

    if (error) {
      console.error('[APPEALS] Error submitting appeal:', error);
      return res.status(500).json({
        error: 'Failed to submit appeal',
        details: error.message,
      });
    }

    return res.status(201).json({
      appeal_id: data,
      status: 'pending',
      message: 'Appeal submitted successfully. We will review it shortly.',
    });
  } catch (err) {
    console.error('[APPEALS] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/appeals
 * Get appeals
 *
 * Query params:
 * - status: 'pending' | 'approved' | 'denied' (optional)
 * - search: string (optional) - Full-text search
 * - limit: number (default 50)
 * - offset: number (default 0)
 *
 * For regular users: Returns their own appeals
 * For admins: Can see all appeals with filters (requires admin check)
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      status,
      search,
      limit = '50',
      offset = '0',
    } = req.query;

    // Check if user is admin (you'll need to implement this check)
    // For now, we'll assume admins have a specific role or metadata
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, metadata')
      .eq('id', userId)
      .single();

    const isAdmin = profile?.role === 'admin' || profile?.metadata?.is_admin === true;

    if (isAdmin) {
      // Admin view: Use search_appeals function
      const { data, error } = await supabase.rpc('search_appeals', {
        p_status: status || null,
        p_user_id: null, // Show all users' appeals
        p_search_term: search || null,
        p_limit: parseInt(limit as string, 10),
        p_offset: parseInt(offset as string, 10),
      });

      if (error) {
        console.error('[APPEALS] Error fetching appeals (admin):', error);
        return res.status(500).json({ error: 'Failed to fetch appeals' });
      }

      return res.json({
        appeals: data || [],
        is_admin: true,
      });
    } else {
      // Regular user: Only their own appeals
      let query = supabase
        .from('appeals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(parseInt(limit as string, 10))
        .range(
          parseInt(offset as string, 10),
          parseInt(offset as string, 10) + parseInt(limit as string, 10) - 1
        );

      // Apply status filter if provided
      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[APPEALS] Error fetching appeals (user):', error);
        return res.status(500).json({ error: 'Failed to fetch appeals' });
      }

      return res.json({
        appeals: data || [],
        is_admin: false,
      });
    }
  } catch (err) {
    console.error('[APPEALS] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/v1/appeals/:id/resolve
 * Resolve an appeal (admin only)
 *
 * Body:
 * - status: 'approved' | 'denied'
 * - resolution_notes: string (min 10 chars)
 *
 * Returns:
 * - success: boolean
 * - appeal: Updated appeal object
 */
router.patch('/:id/resolve', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id: appealId } = req.params;
    const { status, resolution_notes } = req.body;

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, metadata')
      .eq('id', userId)
      .single();

    const isAdmin = profile?.role === 'admin' || profile?.metadata?.is_admin === true;

    if (!isAdmin) {
      return res.status(403).json({
        error: 'Forbidden: Admin access required',
      });
    }

    // Validate input
    if (!status || !['approved', 'denied'].includes(status)) {
      return res.status(400).json({
        error: 'Status must be either "approved" or "denied"',
      });
    }

    if (!resolution_notes || typeof resolution_notes !== 'string' || resolution_notes.trim().length < 10) {
      return res.status(400).json({
        error: 'Resolution notes are required and must be at least 10 characters',
      });
    }

    // Validate appeal ID is a UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(appealId)) {
      return res.status(400).json({ error: 'Invalid appeal ID format' });
    }

    // Call the resolve_appeal function
    const { data, error } = await supabase.rpc('resolve_appeal', {
      p_appeal_id: appealId,
      p_resolved_by: userId,
      p_status: status,
      p_resolution_notes: resolution_notes.trim(),
    });

    if (error) {
      console.error('[APPEALS] Error resolving appeal:', error);

      // Check for specific error messages
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: 'Appeal not found' });
      }
      if (error.message.includes('already been resolved')) {
        return res.status(409).json({ error: 'Appeal has already been resolved' });
      }

      return res.status(500).json({
        error: 'Failed to resolve appeal',
        details: error.message,
      });
    }

    // Fetch the updated appeal
    const { data: appeal, error: fetchError } = await supabase
      .from('appeals')
      .select('*')
      .eq('id', appealId)
      .single();

    if (fetchError) {
      console.error('[APPEALS] Error fetching resolved appeal:', fetchError);
      // Still return success since the resolution worked
      return res.json({
        success: true,
        message: 'Appeal resolved successfully',
      });
    }

    // Queue email notification to user about appeal decision
    try {
      // Get user's email
      const { data: userData } = await supabase.auth.admin.getUserById(appeal.user_id);

      if (userData?.user?.email) {
        await queueAppealDecisionEmail(
          appeal.user_id,
          userData.user.email,
          appealId,
          status,
          resolution_notes.trim(),
          appeal.original_content
        );
      }
    } catch (emailError) {
      console.error('[APPEALS] Error queueing notification email:', emailError);
      // Continue even if email fails - the appeal is already resolved
    }

    return res.json({
      success: true,
      appeal,
      message: `Appeal ${status}. User will be notified via email.`,
    });
  } catch (err) {
    console.error('[APPEALS] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
