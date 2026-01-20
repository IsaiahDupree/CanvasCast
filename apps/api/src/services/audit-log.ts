/**
 * Audit Log Service (MOD-003)
 *
 * Provides functions to log moderation actions to the audit trail.
 * This service uses the Supabase service role client to bypass RLS.
 */

import { createClient } from '@supabase/supabase-js';
import type { ModerationResult } from '@canvascast/shared';

// Initialize Supabase client with service role key (bypasses RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('[AUDIT LOG] Missing Supabase credentials. Audit logging will be disabled.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Audit log entry data
 */
export interface AuditLogEntry {
  userId: string;
  action: 'prompt_submitted' | 'prompt_blocked' | 'content_flagged' | 'account_suspended' | 'appeal_filed' | 'appeal_resolved';
  content: string;
  moderationResult: ModerationResult;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
    [key: string]: any;
  };
}

/**
 * Log a moderation action to the audit trail
 *
 * @param entry - The audit log entry data
 * @returns The ID of the created audit log entry
 */
export async function logAuditEntry(entry: AuditLogEntry): Promise<string | null> {
  try {
    // Don't log if credentials are missing (development mode)
    if (!supabaseUrl || !supabaseServiceKey) {
      console.log('[AUDIT LOG] Skipping audit log in development mode:', {
        action: entry.action,
        contentLength: entry.content.length,
        allowed: entry.moderationResult.allowed,
      });
      return null;
    }

    // Call the log_audit_entry function
    const { data, error } = await supabase.rpc('log_audit_entry', {
      p_user_id: entry.userId,
      p_action: entry.action,
      p_content: entry.content,
      p_moderation_result: entry.moderationResult as any,
      p_metadata: entry.metadata || {},
    });

    if (error) {
      console.error('[AUDIT LOG] Error logging audit entry:', error);
      return null;
    }

    console.log('[AUDIT LOG] Audit entry logged:', {
      id: data,
      action: entry.action,
      userId: entry.userId,
      allowed: entry.moderationResult.allowed,
    });

    return data as string;
  } catch (error: any) {
    console.error('[AUDIT LOG] Exception while logging audit entry:', error);
    return null;
  }
}

/**
 * Log a prompt submission (approved)
 */
export async function logPromptSubmitted(
  userId: string,
  content: string,
  moderationResult: ModerationResult,
  metadata?: AuditLogEntry['metadata']
): Promise<string | null> {
  return logAuditEntry({
    userId,
    action: 'prompt_submitted',
    content,
    moderationResult,
    metadata,
  });
}

/**
 * Log a blocked prompt
 */
export async function logPromptBlocked(
  userId: string,
  content: string,
  moderationResult: ModerationResult,
  metadata?: AuditLogEntry['metadata']
): Promise<string | null> {
  return logAuditEntry({
    userId,
    action: 'prompt_blocked',
    content,
    moderationResult,
    metadata,
  });
}

/**
 * Search audit logs (admin only)
 * This function should only be called from admin API routes with proper authorization
 *
 * @param filters - Search filters
 * @returns Array of audit log entries
 */
export async function searchAuditLogs(filters: {
  userId?: string;
  action?: string;
  searchTerm?: string;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  try {
    const { data, error } = await supabase.rpc('search_audit_logs', {
      p_user_id: filters.userId || null,
      p_action: filters.action || null,
      p_search_term: filters.searchTerm || null,
      p_limit: filters.limit || 100,
      p_offset: filters.offset || 0,
    });

    if (error) {
      console.error('[AUDIT LOG] Error searching audit logs:', error);
      return [];
    }

    return data || [];
  } catch (error: any) {
    console.error('[AUDIT LOG] Exception while searching audit logs:', error);
    return [];
  }
}
