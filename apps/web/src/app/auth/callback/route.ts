import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const claimDraft = requestUrl.searchParams.get("claim_draft");
  const origin = requestUrl.origin;

  if (code) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.exchangeCodeForSession(code);
    
    // If we should claim a draft, do it now
    if (claimDraft && user) {
      const cookieStore = await cookies();
      const sessionToken = cookieStore.get("draft_session")?.value;
      
      if (sessionToken) {
        // Claim the draft prompt
        const { data: draftId } = await supabase.rpc("claim_draft_prompt", {
          p_session_token: sessionToken,
          p_user_id: user.id,
        });
        
        // If we claimed a draft, redirect to new project page with it
        if (draftId) {
          const response = NextResponse.redirect(`${origin}/app/new?draft=${draftId}`);
          response.cookies.delete("draft_session");
          return response;
        }
      }
    }
  }

  return NextResponse.redirect(`${origin}/app`);
}
