/**
 * Admin Audit Log Routes (MOD-003)
 *
 * Provides admin endpoints to search and view audit logs.
 * These routes should be protected by admin authentication middleware.
 */

import { Router, Request, Response } from 'express';
import { searchAuditLogs } from '../../services/audit-log';

const router = Router();

/**
 * GET /api/admin/audit-logs
 *
 * Search and retrieve audit logs with filters.
 * Requires admin authentication.
 *
 * Query parameters:
 * - userId: Filter by user ID (optional)
 * - action: Filter by action type (optional)
 * - search: Full-text search term (optional)
 * - limit: Max results (default 100)
 * - offset: Pagination offset (default 0)
 *
 * Example:
 * GET /api/admin/audit-logs?action=prompt_blocked&limit=50
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // TODO: Add admin authentication check here
    // For now, this is a placeholder - implement admin auth in ADMIN-001

    const filters = {
      userId: req.query.userId as string | undefined,
      action: req.query.action as string | undefined,
      searchTerm: req.query.search as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    };

    // Validate limit and offset
    if (filters.limit < 1 || filters.limit > 1000) {
      res.status(400).json({
        error: 'Invalid limit',
        message: 'Limit must be between 1 and 1000',
      });
      return;
    }

    if (filters.offset < 0) {
      res.status(400).json({
        error: 'Invalid offset',
        message: 'Offset must be non-negative',
      });
      return;
    }

    // Search audit logs
    const logs = await searchAuditLogs(filters);

    res.json({
      success: true,
      data: logs,
      meta: {
        limit: filters.limit,
        offset: filters.offset,
        count: logs.length,
      },
    });
  } catch (error: any) {
    console.error('[ADMIN] Error fetching audit logs:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch audit logs',
    });
  }
});

/**
 * GET /api/admin/audit-logs/stats
 *
 * Get statistics about audit logs
 * Requires admin authentication.
 *
 * Returns:
 * - Total count of audit logs
 * - Count by action type
 * - Count of blocked prompts today
 * - Recent activity summary
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // TODO: Add admin authentication check here

    // For now, return placeholder stats
    // This can be enhanced with actual queries to the database
    const stats = {
      total: 0,
      byAction: {
        prompt_submitted: 0,
        prompt_blocked: 0,
        content_flagged: 0,
      },
      blockedToday: 0,
      recentActivity: [],
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('[ADMIN] Error fetching audit log stats:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch audit log statistics',
    });
  }
});

/**
 * GET /api/admin/audit-logs/:id
 *
 * Get a specific audit log entry by ID
 * Requires admin authentication.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    // TODO: Add admin authentication check here

    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      res.status(400).json({
        error: 'Invalid ID',
        message: 'Audit log ID must be a valid UUID',
      });
      return;
    }

    // Search for the specific audit log entry
    const logs = await searchAuditLogs({ limit: 1, offset: 0 });
    const log = logs.find((l) => l.id === id);

    if (!log) {
      res.status(404).json({
        error: 'Not found',
        message: 'Audit log entry not found',
      });
      return;
    }

    res.json({
      success: true,
      data: log,
    });
  } catch (error: any) {
    console.error('[ADMIN] Error fetching audit log:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch audit log',
    });
  }
});

export default router;
