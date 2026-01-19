"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import type { User } from "@supabase/supabase-js";

/**
 * useAuth Hook
 *
 * Manages authentication state with Supabase Auth.
 *
 * Features:
 * - Returns current user state
 * - Handles loading state during initial session check
 * - Subscribes to auth state changes (sign in, sign out, token refresh)
 * - Automatically updates when user signs in or out
 * - Cleans up subscription on unmount
 *
 * @returns {Object} Auth state
 * @returns {User | null} user - Current authenticated user or null
 * @returns {boolean} loading - True during initial session check
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, loading } = useAuth();
 *
 *   if (loading) return <div>Loading...</div>;
 *   if (!user) return <div>Please sign in</div>;
 *
 *   return <div>Welcome, {user.email}</div>;
 * }
 * ```
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
      } catch (error) {
        console.error("Error fetching session:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}
