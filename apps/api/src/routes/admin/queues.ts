/**
 * Admin Queue Health API Routes
 * ADMIN-004: Queue Health Dashboard
 */

import express, { Request, Response, Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { getJobQueue } from '../../lib/queue.js';

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

// GET /api/v1/admin/queues/stats - Get queue health statistics
router.get('/stats', requireAdmin, async (req: Request, res: Response) => {
  try {
    const queue = getJobQueue();

    if (!queue) {
      return res.status(503).json({ error: 'Queue not available' });
    }

    // Get job counts by status
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    // Get queue status
    const isPaused = await queue.isPaused();

    // Get active jobs to identify stuck ones
    const activeJobs = await queue.getActive();
    const stuckThreshold = 30 * 60 * 1000; // 30 minutes in milliseconds
    const now = Date.now();

    const stuckJobs = activeJobs
      .filter((job) => {
        const timestamp = job.timestamp || 0;
        const duration = now - timestamp;
        return duration > stuckThreshold;
      })
      .map((job) => ({
        id: job.id,
        name: job.name,
        timestamp: job.timestamp,
        duration: now - (job.timestamp || 0),
        data: job.data,
      }));

    // Get worker count from Redis (approximate)
    // BullMQ doesn't have a direct way to get worker count, so we'll return a placeholder
    const workers = {
      active: activeJobs.length > 0 ? 1 : 0, // Simplified: if there are active jobs, assume at least 1 worker
    };

    return res.json({
      queues: [
        {
          name: queue.name,
          waiting,
          active,
          completed,
          failed,
          delayed,
          isPaused,
        },
      ],
      stuckJobs,
      workers,
    });
  } catch (err) {
    console.error('Error in GET /admin/queues/stats:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/queues/:queueName/retry/:jobId - Retry a failed job
router.post('/:queueName/retry/:jobId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const queue = getJobQueue();

    if (!queue) {
      return res.status(503).json({ error: 'Queue not available' });
    }

    // Get the job
    const job = await queue.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Retry the job
    await job.retry();

    return res.json({
      success: true,
      message: `Job ${jobId} has been retried`,
    });
  } catch (err) {
    console.error('Error in POST /admin/queues/:queueName/retry/:jobId:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/queues/:queueName/pause - Pause a queue
router.post('/:queueName/pause', requireAdmin, async (req: Request, res: Response) => {
  try {
    const queue = getJobQueue();

    if (!queue) {
      return res.status(503).json({ error: 'Queue not available' });
    }

    await queue.pause();

    return res.json({
      success: true,
      message: `Queue ${queue.name} has been paused`,
    });
  } catch (err) {
    console.error('Error in POST /admin/queues/:queueName/pause:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/queues/:queueName/resume - Resume a queue
router.post('/:queueName/resume', requireAdmin, async (req: Request, res: Response) => {
  try {
    const queue = getJobQueue();

    if (!queue) {
      return res.status(503).json({ error: 'Queue not available' });
    }

    await queue.resume();

    return res.json({
      success: true,
      message: `Queue ${queue.name} has been resumed`,
    });
  } catch (err) {
    console.error('Error in POST /admin/queues/:queueName/resume:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
