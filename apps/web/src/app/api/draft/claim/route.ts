import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

// POST - Claim a draft prompt after user signs up/logs in
export async function POST() {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("draft_session")?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ claimed: false, message: "No draft session found" });
    }

    // Claim the draft
    const { data, error } = await supabase.rpc("claim_draft_prompt", {
      p_session_token: sessionToken,
      p_user_id: user.id,
    });

    if (error) {
      console.error("Claim draft error:", error);
      return NextResponse.json(
        { error: "Failed to claim draft" },
        { status: 500 }
      );
    }

    // Clear the session cookie after claiming
    const response = NextResponse.json({ 
      claimed: !!data,
      draftId: data,
    });
    
    if (data) {
      response.cookies.delete("draft_session");
    }
    
    return response;
  } catch (error) {
    console.error("Claim draft API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
