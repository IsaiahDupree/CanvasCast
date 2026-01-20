/**
 * RESIL-003: Dead Letter Queue Admin API Routes
 *
 * Admin endpoints for managing the dead letter queue:
 * - GET /api/admin/dlq - List all jobs in the DLQ
 * - POST /api/admin/dlq/:jobId/retry - Retry a job from the DLQ
 */

import type { Request, Response, Router as ExpressRouter } from 'express';
import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

// Inline DLQ helper functions to avoid cross-package dependencies

/**
 * Retrieves all jobs in the dead letter queue
 */
async function getDeadLetterQueueJobs(supabase: any): Promise<any[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .not('dlq_at', 'is', null)
    .order('dlq_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch DLQ jobs:', error.message);
    throw error;
  }

  return data || [];
}

/**
 * Retries a job from the dead letter queue by resetting its status
 */
async function retryJobFromDeadLetterQueue(
  supabase: any,
  jobId: string
): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .update({
      status: 'PENDING',
      retry_count: 0,
      dlq_at: null,
      dlq_reason: null,
      error_code: null,
      error_message: null,
      started_at: null,
      finished_at: null,
    })
    .eq('id', jobId);

  if (error) {
    console.error('Failed to retry job from DLQ:', error.message);
    throw error;
  }

  console.log(`[DLQ] Retrying job ${jobId} from dead letter queue`);
}

const router = Router();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * GET /api/admin/dlq
 * List all jobs in the dead letter queue
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const jobs = await getDeadLetterQueueJobs(supabase);

    res.json({
      success: true,
      data: {
        jobs,
        count: jobs.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching DLQ jobs:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DLQ_FETCH_ERROR',
        message: 'Failed to fetch dead letter queue jobs',
        details: error.message,
      },
    });
  }
});

/**
 * POST /api/admin/dlq/:jobId/retry
 * Retry a job from the dead letter queue
 */
router.post('/:jobId/retry', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_JOB_ID',
          message: 'Job ID is required',
        },
      });
    }

    // Verify job exists in DLQ
    const { data: job, error: fetchError } = await supabase
      .from('jobs')
      .select('id, dlq_at, status')
      .eq('id', jobId)
      .single();

    if (fetchError || !job) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'JOB_NOT_FOUND',
          message: 'Job not found',
        },
      });
    }

    if (!job.dlq_at) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'JOB_NOT_IN_DLQ',
          message: 'Job is not in the dead letter queue',
        },
      });
    }

    // Retry the job
    await retryJobFromDeadLetterQueue(supabase, jobId);

    res.json({
      success: true,
      data: {
        jobId,
        message: 'Job has been reset and can be retried',
      },
    });
  } catch (error: any) {
    console.error('Error retrying DLQ job:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DLQ_RETRY_ERROR',
        message: 'Failed to retry job from dead letter queue',
        details: error.message,
      },
    });
  }
});

/**
 * GET /api/admin/dlq/:jobId
 * Get details of a specific job in the DLQ
 */
router.get('/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_JOB_ID',
          message: 'Job ID is required',
        },
      });
    }

    const { data: job, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .not('dlq_at', 'is', null)
      .single();

    if (error || !job) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'JOB_NOT_FOUND',
          message: 'Job not found in dead letter queue',
        },
      });
    }

    res.json({
      success: true,
      data: { job },
    });
  } catch (error: any) {
    console.error('Error fetching DLQ job:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DLQ_FETCH_ERROR',
        message: 'Failed to fetch job from dead letter queue',
        details: error.message,
      },
    });
  }
});

const dlqRouter: ExpressRouter = router;
export default dlqRouter;
