/**
 * Data Export Routes
 * For GDPR-003: Data Export feature
 *
 * Endpoints:
 * - GET /api/v1/account/export - Download all user data as ZIP
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import archiver from 'archiver';

const router: Router = Router();

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// Auth middleware interface
interface AuthenticatedRequest extends Request {
  user?: { id: string; email?: string };
}

/**
 * GET /api/v1/account/export
 * Export all user data as a ZIP file containing JSON files
 */
router.get('/export', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log(`[DATA-EXPORT] Starting export for user ${user.id}`);

    // Fetch all user data from database
    const [profileResult, projectsResult, jobsResult, creditsResult, subscriptionsResult] =
      await Promise.all([
        // Profile data
        supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single(),

        // Projects data
        supabase
          .from('projects')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),

        // Jobs data
        supabase
          .from('jobs')
          .select(`
            *,
            job_steps (*)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),

        // Credit ledger
        supabase
          .from('credit_ledger')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),

        // Subscriptions
        supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

    // Check for errors
    if (profileResult.error) {
      console.error('[DATA-EXPORT] Error fetching profile:', profileResult.error);
      return res.status(500).json({ error: 'Failed to fetch profile data' });
    }

    if (projectsResult.error) {
      console.error('[DATA-EXPORT] Error fetching projects:', projectsResult.error);
      return res.status(500).json({ error: 'Failed to fetch projects data' });
    }

    if (jobsResult.error) {
      console.error('[DATA-EXPORT] Error fetching jobs:', jobsResult.error);
      return res.status(500).json({ error: 'Failed to fetch jobs data' });
    }

    if (creditsResult.error) {
      console.error('[DATA-EXPORT] Error fetching credits:', creditsResult.error);
      return res.status(500).json({ error: 'Failed to fetch credits data' });
    }

    if (subscriptionsResult.error) {
      console.error('[DATA-EXPORT] Error fetching subscriptions:', subscriptionsResult.error);
      return res.status(500).json({ error: 'Failed to fetch subscriptions data' });
    }

    // Sanitize sensitive data
    const sanitizeProfile = (profile: any) => {
      const { ...rest } = profile;
      // Remove any sensitive fields if they exist
      delete rest.password;
      delete rest.password_hash;
      return rest;
    };

    const profile = sanitizeProfile(profileResult.data);
    const projects = projectsResult.data || [];
    const jobs = jobsResult.data || [];
    const credits = creditsResult.data || [];
    const subscriptions = subscriptionsResult.data || [];

    // Create ZIP file
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    });

    // Set response headers
    const timestamp = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="canvascast-data-export-${timestamp}.zip"`
    );

    // Pipe archive to response
    archive.pipe(res);

    // Add JSON files to archive
    archive.append(JSON.stringify(profile, null, 2), { name: 'profile.json' });
    archive.append(JSON.stringify(projects, null, 2), { name: 'projects.json' });
    archive.append(JSON.stringify(jobs, null, 2), { name: 'jobs.json' });
    archive.append(JSON.stringify(credits, null, 2), { name: 'credits.json' });
    archive.append(JSON.stringify(subscriptions, null, 2), { name: 'subscriptions.json' });

    // Add metadata file
    const metadata = {
      export_date: new Date().toISOString(),
      user_id: user.id,
      user_email: user.email,
      data_includes: [
        'profile',
        'projects',
        'jobs',
        'credits',
        'subscriptions',
      ],
      total_projects: projects.length,
      total_jobs: jobs.length,
      total_credit_transactions: credits.length,
      total_subscriptions: subscriptions.length,
    };
    archive.append(JSON.stringify(metadata, null, 2), { name: 'export-metadata.json' });

    // Add README
    const readme = `# CanvasCast Data Export

This archive contains all your data from CanvasCast as of ${metadata.export_date}.

## Contents

- **profile.json**: Your account profile information
- **projects.json**: All your video projects
- **jobs.json**: All your video generation jobs and their steps
- **credits.json**: Your complete credit transaction history
- **subscriptions.json**: Your subscription history
- **export-metadata.json**: Information about this export

## Data Format

All files are in JSON format and can be opened with any text editor or JSON viewer.

## Questions?

If you have questions about your data, please contact support at support@canvascast.com.
`;
    archive.append(readme, { name: 'README.md' });

    // Finalize archive
    await archive.finalize();

    console.log(`[DATA-EXPORT] Export completed for user ${user.id}`);
  } catch (error) {
    console.error('[DATA-EXPORT] Error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default router;
