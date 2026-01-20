import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { rateLimitByIP } from "@/lib/ratelimit";

const DraftSchema = z.object({
  promptText: z.string().min(10, "Prompt must be at least 10 characters"),
  templateId: z.string().optional().default("narrated_storyboard_v1"),
  options: z.record(z.unknown()).optional().default({}),
});

// Get or create session token for anonymous users
async function getSessionToken(): Promise<string> {
  const cookieStore = await cookies();
  let token = cookieStore.get("draft_session")?.value;

  if (!token) {
    token = crypto.randomUUID();
  }

  return token;
}

// Get IP address from request headers
async function getClientIP(): Promise<string> {
  const headersList = await headers();
  const forwardedFor = headersList.get("x-forwarded-for");
  const realIp = headersList.get("x-real-ip");

  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  return "unknown";
}

// POST - Create or update a draft prompt (pre-auth)
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();

    // Apply rate limiting for anonymous users only
    // Authenticated users bypass the rate limit
    if (!user) {
      const clientIP = await getClientIP();
      const rateLimitResult = await rateLimitByIP(clientIP, {
        requests: 10,
        window: "1m",
        prefix: "ratelimit:draft",
      });

      // Set rate limit headers
      const response = NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
          retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000),
        },
        { status: 429 }
      );
      response.headers.set("X-RateLimit-Limit", rateLimitResult.limit.toString());
      response.headers.set("X-RateLimit-Remaining", rateLimitResult.remaining.toString());
      response.headers.set("X-RateLimit-Reset", rateLimitResult.reset.toString());

      if (!rateLimitResult.success) {
        return response;
      }
    }

    const body = await request.json();
    const parsed = DraftSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const sessionToken = await getSessionToken();
    
    // Upsert draft (update if exists for this session, create if not)
    const { data: draft, error } = await supabase
      .from("draft_prompts")
      .upsert(
        {
          session_token: sessionToken,
          prompt_text: parsed.data.promptText,
          template_id: parsed.data.templateId,
          options_json: parsed.data.options,
          claimed_by_user_id: user?.id || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "session_token",
        }
      )
      .select()
      .single();

    if (error) {
      // If upsert fails due to no conflict column, try insert
      const { data: newDraft, error: insertError } = await supabase
        .from("draft_prompts")
        .insert({
          session_token: sessionToken,
          prompt_text: parsed.data.promptText,
          template_id: parsed.data.templateId,
          options_json: parsed.data.options,
          claimed_by_user_id: user?.id || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Draft creation error:", insertError);
        return NextResponse.json(
          { error: "Failed to save draft" },
          { status: 500 }
        );
      }

      const response = NextResponse.json({ 
        draftId: newDraft.id,
        sessionToken,
        isAuthenticated: !!user,
      });
      
      // Set session cookie if not authenticated
      if (!user) {
        response.cookies.set("draft_session", sessionToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 7, // 7 days
        });
      }
      
      return response;
    }

    const response = NextResponse.json({ 
      draftId: draft.id,
      sessionToken,
      isAuthenticated: !!user,
    });
    
    // Set session cookie if not authenticated
    if (!user) {
      response.cookies.set("draft_session", sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
    }
    
    return response;
  } catch (error) {
    console.error("Draft API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET - Retrieve draft for current session/user
export async function GET() {
  try {
    const sessionToken = await getSessionToken();
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    
    // Try to find draft by user first, then by session
    let draft = null;
    
    if (user) {
      const { data } = await supabase
        .from("draft_prompts")
        .select("*")
        .eq("claimed_by_user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      draft = data;
    }
    
    if (!draft) {
      const { data } = await supabase
        .from("draft_prompts")
        .select("*")
        .eq("session_token", sessionToken)
        .is("claimed_by_user_id", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      draft = data;
    }
    
    if (!draft) {
      return NextResponse.json({ draft: null });
    }
    
    return NextResponse.json({ 
      draft: {
        id: draft.id,
        promptText: draft.prompt_text,
        templateId: draft.template_id,
        options: draft.options_json,
        createdAt: draft.created_at,
      }
    });
  } catch (error) {
    console.error("Draft GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
