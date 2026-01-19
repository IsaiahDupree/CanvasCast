import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const draftParam = requestUrl.searchParams.get("draft");
  const origin = requestUrl.origin;

  // Handle missing auth code
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_code_missing`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  // Handle auth exchange errors
  if (error || !data.user) {
    console.error("Auth callback error:", error);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const user = data.user;
  let claimedDraftId: string | null = null;

  // Try to claim any pending draft
  if (draftParam) {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("draft_session")?.value;

    if (sessionToken) {
      try {
        const { data: draftId, error: draftError } = await supabase.rpc("claim_draft_prompt", {
          p_session_token: sessionToken,
          p_user_id: user.id,
        });

        if (!draftError && draftId) {
          claimedDraftId = draftId;
        }
      } catch (err) {
        console.error("Failed to claim draft:", err);
        // Continue with redirect even if draft claim fails
      }
    }
  }

  // Build redirect URL
  const redirectUrl = claimedDraftId
    ? `${origin}/app/new?draft=${claimedDraftId}`
    : `${origin}/app`;

  const response = NextResponse.redirect(redirectUrl);

  // Clean up draft session cookie if we had one
  if (draftParam) {
    response.cookies.delete("draft_session");
  }

  return response;
}
