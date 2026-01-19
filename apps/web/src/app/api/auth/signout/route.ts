import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/signout
 *
 * Signs out the current user by clearing their session.
 * Uses POST method to prevent CSRF attacks.
 *
 * Acceptance Criteria (AUTH-006):
 * - Clears session
 * - Redirects to landing page (/)
 */
export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;

  const supabase = await createClient();

  // Sign out the user - this clears the session
  const { error } = await supabase.auth.signOut();

  // Even if there's an error (e.g., no session), still redirect to landing
  // This ensures users always get redirected even if already signed out
  if (error) {
    console.error("Signout error:", error);
  }

  // Redirect to landing page
  return NextResponse.redirect(`${origin}/`);
}
