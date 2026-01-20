/**
 * Admin User Management API Routes
 * ADMIN-003: User Management
 */

import express, { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

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

// GET /api/v1/admin/users - List users with pagination and search
router.get('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('profiles')
      .select('id, email, display_name, account_status, created_at, is_admin', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply search filter if provided
    if (search) {
      query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`);
    }

    const { data: users, error, count } = await query;

    if (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    // Get credit balances for each user
    const usersWithCredits = await Promise.all(
      (users || []).map(async (user) => {
        const { data: balance } = await supabase.rpc('get_credit_balance', {
          p_user_id: user.id,
        });

        return {
          ...user,
          credit_balance: balance || 0,
        };
      })
    );

    return res.json({
      users: usersWithCredits,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err) {
    console.error('Error in GET /admin/users:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/users/:id - Get user details
router.get('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get credit balance
    const { data: creditBalance } = await supabase.rpc('get_credit_balance', {
      p_user_id: userId,
    });

    // Get job count
    const { count: jobCount } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    return res.json({
      ...profile,
      credit_balance: creditBalance || 0,
      job_count: jobCount || 0,
    });
  } catch (err) {
    console.error('Error in GET /admin/users/:id:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/users/:id/credits - Adjust user credits
router.post('/:id/credits', requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const { amount, note } = req.body;

    // Validate input
    if (typeof amount !== 'number' || isNaN(amount)) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (!note || typeof note !== 'string' || note.trim().length === 0) {
      return res.status(400).json({ error: 'Note is required' });
    }

    // Check if user exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Add credit transaction
    const { data: transaction, error: transactionError } = await supabase
      .from('credit_ledger')
      .insert({
        user_id: userId,
        type: amount > 0 ? 'purchase' : 'refund',
        amount: Math.abs(amount),
        note: `Admin adjustment: ${note}`,
      })
      .select('id')
      .single();

    if (transactionError) {
      console.error('Error creating credit transaction:', transactionError);
      return res.status(500).json({ error: 'Failed to adjust credits' });
    }

    // Get new balance
    const { data: newBalance } = await supabase.rpc('get_credit_balance', {
      p_user_id: userId,
    });

    return res.json({
      success: true,
      new_balance: newBalance || 0,
      transaction_id: transaction.id,
    });
  } catch (err) {
    console.error('Error in POST /admin/users/:id/credits:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/v1/admin/users/:id/status - Update account status
router.patch('/:id/status', requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const { status, reason } = req.body;

    // Validate status
    const validStatuses = ['active', 'suspended', 'deleted'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Must be one of: active, suspended, deleted'
      });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Reason is required' });
    }

    // Update user status
    const { data: profile, error: updateError } = await supabase
      .from('profiles')
      .update({
        account_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('id, account_status')
      .single();

    if (updateError || !profile) {
      console.error('Error updating account status:', updateError);
      return res.status(404).json({ error: 'User not found or update failed' });
    }

    // Log the status change in audit log if table exists
    try {
      await supabase.from('audit_log').insert({
        user_id: userId,
        action: 'account_status_changed',
        details: {
          new_status: status,
          reason,
          changed_by: (req as any).user?.id,
        },
      });
    } catch (auditError) {
      // Audit log is optional, don't fail the request
      console.warn('Failed to log status change:', auditError);
    }

    return res.json({
      success: true,
      account_status: profile.account_status,
    });
  } catch (err) {
    console.error('Error in PATCH /admin/users/:id/status:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/users/:id/activity - Get user activity log
router.get('/:id/activity', requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;

    // Get recent jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, status, created_at, completed_at, error_message')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (jobsError) {
      console.error('Error fetching jobs:', jobsError);
    }

    // Get recent credit transactions
    const { data: creditTransactions, error: creditsError } = await supabase
      .from('credit_ledger')
      .select('id, type, amount, note, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (creditsError) {
      console.error('Error fetching credit transactions:', creditsError);
    }

    return res.json({
      jobs: jobs || [],
      credit_transactions: creditTransactions || [],
    });
  } catch (err) {
    console.error('Error in GET /admin/users/:id/activity:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
