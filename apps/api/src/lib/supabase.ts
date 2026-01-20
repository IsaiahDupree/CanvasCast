/**
 * Supabase Client for API
 * Shared Supabase client instance for server-side operations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

/**
 * Get or create Supabase client instance
 */
export function getSupabaseClient(): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // In test environment, return a minimal mock
    if (process.env.NODE_ENV === 'test') {
      supabaseInstance = {
        from: () => ({
          select: () => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) }),
          update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
          insert: () => Promise.resolve({ data: null, error: null }),
        }),
        auth: {
          getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        },
      } as any;
      return supabaseInstance;
    }
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
  }

  supabaseInstance = createClient(supabaseUrl, supabaseKey);
  return supabaseInstance;
}

/**
 * Export for convenience
 */
export const supabase = getSupabaseClient();
