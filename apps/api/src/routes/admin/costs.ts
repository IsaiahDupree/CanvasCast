/**
 * Admin Cost Dashboard API Routes
 * ADMIN-005: Cost Dashboard
 *
 * Provides endpoints for aggregating and analyzing API costs
 * across all jobs and services (OpenAI, Gemini, Storage)
 */

import express, { Request, Response, Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router: Router = express.Router();

// Supabase admin client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// Middleware to check if user is admin
async function requireAdmin(req: Request, res: Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Attach user to request
    (req as any).user = user;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Helper to calculate date range
function getDateRange(range: string): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();

  switch (range) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(end.getDate() - 7);
      break;
    case 'month':
      start.setDate(end.getDate() - 30);
      break;
    case 'quarter':
      start.setDate(end.getDate() - 90);
      break;
    default:
      start.setDate(end.getDate() - 7); // Default to last 7 days
  }

  return { start, end };
}

// GET /api/v1/admin/costs/summary - Get cost summary with breakdown
router.get('/summary', requireAdmin, async (req: Request, res: Response) => {
  try {
    const range = (req.query.range as string) || 'week';
    const { start, end } = getDateRange(range);

    // Get total costs and breakdown by service
    const { data: costs, error: costsError } = await supabase
      .from('job_costs')
      .select('service, operation, cost_usd, created_at')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    if (costsError) {
      console.error('[Admin Costs] Error fetching costs:', costsError);
      return res.status(500).json({ error: 'Failed to fetch costs' });
    }

    if (!costs || costs.length === 0) {
      return res.json({
        totalCost: 0,
        dateRange: {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0],
        },
        breakdown: {
          openai: 0,
          gemini: 0,
          storage: 0,
        },
        daily: [],
        byService: [],
      });
    }

    // Calculate breakdown by service
    const breakdown: Record<string, number> = {
      openai: 0,
      gemini: 0,
      storage: 0,
    };

    // Track by service and operation
    const byServiceMap: Record<string, Record<string, number>> = {
      openai: {},
      gemini: {},
      storage: {},
    };

    // Track daily costs
    const dailyMap: Record<string, { date: string; openai: number; gemini: number; storage: number; total: number }> = {};

    for (const cost of costs) {
      const costUsd = parseFloat(cost.cost_usd);
      breakdown[cost.service] += costUsd;

      // Track by operation
      if (!byServiceMap[cost.service][cost.operation]) {
        byServiceMap[cost.service][cost.operation] = 0;
      }
      byServiceMap[cost.service][cost.operation] += costUsd;

      // Track daily
      const date = cost.created_at.split('T')[0];
      if (!dailyMap[date]) {
        dailyMap[date] = { date, openai: 0, gemini: 0, storage: 0, total: 0 };
      }
      dailyMap[date][cost.service as 'openai' | 'gemini' | 'storage'] += costUsd;
      dailyMap[date].total += costUsd;
    }

    // Convert daily map to sorted array
    const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    // Convert service map to array format
    const byService = Object.entries(byServiceMap).map(([service, operations]) => ({
      service,
      operations,
    }));

    const totalCost = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

    return res.json({
      totalCost: parseFloat(totalCost.toFixed(2)),
      dateRange: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      },
      breakdown: {
        openai: parseFloat(breakdown.openai.toFixed(2)),
        gemini: parseFloat(breakdown.gemini.toFixed(2)),
        storage: parseFloat(breakdown.storage.toFixed(2)),
      },
      daily,
      byService,
    });
  } catch (err) {
    console.error('[Admin Costs] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/costs/trends - Get cost trends over time
router.get('/trends', requireAdmin, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const start = new Date();
    start.setDate(start.getDate() - days);

    const { data: costs, error } = await supabase
      .from('job_costs')
      .select('service, cost_usd, created_at')
      .gte('created_at', start.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Admin Costs] Error fetching trends:', error);
      return res.status(500).json({ error: 'Failed to fetch trends' });
    }

    // Group by date
    const dailyTrends: Record<string, { date: string; openai: number; gemini: number; storage: number; total: number }> = {};

    for (const cost of costs || []) {
      const date = cost.created_at.split('T')[0];
      if (!dailyTrends[date]) {
        dailyTrends[date] = { date, openai: 0, gemini: 0, storage: 0, total: 0 };
      }
      const costUsd = parseFloat(cost.cost_usd);
      dailyTrends[date][cost.service as 'openai' | 'gemini' | 'storage'] += costUsd;
      dailyTrends[date].total += costUsd;
    }

    const trends = Object.values(dailyTrends);

    return res.json({ trends });
  } catch (err) {
    console.error('[Admin Costs] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/costs/top-jobs - Get most expensive jobs
router.get('/top-jobs', requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const range = (req.query.range as string) || 'week';
    const { start } = getDateRange(range);

    // Aggregate costs by job_id
    const { data, error } = await supabase.rpc('get_top_expensive_jobs', {
      p_start_date: start.toISOString(),
      p_limit: limit,
    });

    if (error) {
      console.error('[Admin Costs] Error fetching top jobs:', error);
      // Fallback to manual aggregation if RPC doesn't exist
      const { data: costs, error: costsError } = await supabase
        .from('job_costs')
        .select('job_id, cost_usd, jobs(title)')
        .gte('created_at', start.toISOString());

      if (costsError) {
        return res.status(500).json({ error: 'Failed to fetch top jobs' });
      }

      // Manual aggregation
      const jobMap: Record<string, { jobId: string; title: string; totalCost: number }> = {};
      for (const cost of costs || []) {
        if (!jobMap[cost.job_id]) {
          jobMap[cost.job_id] = {
            jobId: cost.job_id,
            title: (cost.jobs as any)?.title || 'Unknown',
            totalCost: 0,
          };
        }
        jobMap[cost.job_id].totalCost += parseFloat(cost.cost_usd);
      }

      const topJobs = Object.values(jobMap)
        .sort((a, b) => b.totalCost - a.totalCost)
        .slice(0, limit);

      return res.json({ topJobs });
    }

    return res.json({ topJobs: data });
  } catch (err) {
    console.error('[Admin Costs] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
