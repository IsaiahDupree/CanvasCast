# PRD: Authentication & User Management

**Subsystem:** Auth  
**Version:** 1.0  
**Status:** Implemented  
**Owner:** Isaiah  

---

## 1. Overview

Authentication is handled by Supabase Auth, providing email magic links, OAuth (Google), and session management. Upon signup, users receive a trial credit grant and a profile record is created.

### Business Goal
Frictionless signup that converts draft-holders into registered users with minimal barriers.

---

## 2. User Stories

### US-1: Email Magic Link
**As a** new user  
**I want to** sign up with just my email  
**So that** I don't need to remember a password

### US-2: Google OAuth
**As a** user  
**I want to** sign up with Google  
**So that** signup is one click

### US-3: Trial Credit Grant
**As a** new user  
**I want to** receive free credits on signup  
**So that** I can try the product immediately

### US-4: Session Persistence
**As a** returning user  
**I want to** stay logged in  
**So that** I don't have to re-authenticate

---

## 3. Auth Flows

### Flow A: Email Magic Link

```
1. User enters email on /signup
2. Supabase sends magic link email
3. User clicks link → redirected to /auth/callback
4. Session created, user redirected to /app
5. Draft claimed (if exists)
```

### Flow B: Google OAuth

```
1. User clicks "Sign in with Google"
2. Redirect to Google consent screen
3. Google redirects back with code
4. Supabase exchanges code for session
5. User redirected to /app
6. Draft claimed (if exists)
```

---

## 4. Functional Requirements

### FR-1: Signup Page

**Route:** `/signup`

**Query Params:**
- `draft` - Draft ID to claim after auth

**Elements:**
- Email input
- "Sign in with Google" button
- "Your prompt is saved" message (if draft exists)
- Link to login for existing users

### FR-2: Login Page

**Route:** `/login`

**Elements:**
- Email input
- "Sign in with Google" button
- Link to signup for new users

### FR-3: Auth Callback

**Route:** `/auth/callback`

**Behavior:**
1. Exchange code for session
2. Claim any pending drafts
3. Redirect to `/app/new?draft={id}` or `/app`

### FR-4: Logout

**Route:** `/api/auth/signout`

**Behavior:**
1. Clear Supabase session
2. Redirect to landing page

---

## 5. Data Model

### Table: `profiles`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, FK → auth.users |
| `email` | TEXT | From auth.users |
| `display_name` | TEXT | Nullable |
| `avatar_url` | TEXT | Nullable |
| `stripe_customer_id` | TEXT | Nullable |
| `notification_prefs` | JSONB | DEFAULT '{}' |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() |

### Trigger: `handle_new_user`

On `auth.users` INSERT:
1. Create profile row
2. Grant trial credits (10 minutes worth)

```sql
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, stripe_customer_id)
  VALUES (NEW.id, NULL);
  
  INSERT INTO credit_ledger (user_id, type, amount, note)
  VALUES (NEW.id, 'purchase', 10, 'Welcome bonus: 1 free video trial');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 6. Middleware

### Protected Routes

All routes under `/app/*` require authentication.

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const supabase = createMiddlewareClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session && request.nextUrl.pathname.startsWith('/app')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  return NextResponse.next();
}
```

---

## 7. Session Management

### Token Refresh
- Supabase handles automatic token refresh
- Access tokens expire in 1 hour
- Refresh tokens expire in 7 days

### Cookie Configuration
```typescript
{
  name: 'sb-auth-token',
  lifetime: 60 * 60 * 24 * 7, // 7 days
  domain: process.env.COOKIE_DOMAIN,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production'
}
```

---

## 8. Security Considerations

### Email Verification
- Magic links are single-use
- Links expire after 1 hour
- Rate limited to 3 per email per hour

### OAuth Security
- State parameter for CSRF protection
- PKCE flow for public clients
- Scopes: email, profile

### Session Security
- HTTP-only cookies
- Secure flag in production
- CSRF tokens for mutations

---

## 9. Error Handling

| Error | User Message | Action |
|-------|--------------|--------|
| Invalid magic link | "This link has expired" | Show resend option |
| OAuth cancelled | "Sign in cancelled" | Return to signup |
| Rate limited | "Too many attempts" | Show countdown |
| Email not found | N/A (always say "check email") | Prevent enumeration |

---

## 10. Metrics

| Metric | Description |
|--------|-------------|
| `signups_total` | Total new users |
| `signups_by_method` | Email vs Google breakdown |
| `login_success_rate` | Successful logins / attempts |
| `session_duration_avg` | Average session length |
| `draft_to_signup_rate` | Drafts that convert to signups |

---

## 11. Files

| File | Purpose |
|------|---------|
| `apps/web/src/app/signup/page.tsx` | Signup UI |
| `apps/web/src/app/login/page.tsx` | Login UI |
| `apps/web/src/app/auth/callback/route.ts` | OAuth callback |
| `apps/web/src/middleware.ts` | Route protection |
| `apps/web/src/lib/supabase/server.ts` | Server client |
| `apps/web/src/lib/supabase/client.ts` | Browser client |

---

## 12. System Integration

### Communicates With

| Subsystem | Direction | Mechanism | Purpose |
|-----------|-----------|-----------|---------|
| **Draft** | Auth ← Draft | RPC call | Claim draft on signup |
| **Billing** | Auth → Billing | DB trigger | Grant trial credits |
| **Email** | Auth → Email | Queue | Send welcome email |
| **All Protected** | Auth → * | Middleware | Session validation |

### Inbound Interfaces

```typescript
// From Supabase Auth: New user trigger
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

// From Draft: Claim request (via auth callback)
const { data } = await supabase.rpc('claim_draft_prompt', {
  p_session_token: cookieSessionToken,
  p_user_id: newUser.id
});
```

### Outbound Interfaces

```typescript
// To Billing: Grant trial credits (via trigger)
INSERT INTO credit_ledger (user_id, type, amount, note)
VALUES (NEW.id, 'purchase', 10, 'Welcome bonus: 1 free video trial');

// To Email: Welcome notification
await emailQueue.add('send', {
  to: user.email,
  template: 'welcome',
  data: { name: user.display_name, trialCredits: 10 }
});

// To All Protected Routes: Session token
// Provided via Supabase session cookies
```

### Integration Diagram

```
                    ┌─────────────────────────────────────────┐
                    │             AUTH SUBSYSTEM               │
                    │                                         │
┌─────────┐         │  ┌──────────┐    ┌──────────────────┐  │
│  Draft  │─────────┼─►│ Callback │───►│ claim_draft()    │  │
│Subsystem│ session │  │  Route   │    └──────────────────┘  │
└─────────┘  token  │  └────┬─────┘                          │
                    │       │                                 │
                    │       ▼                                 │
                    │  ┌──────────┐    ┌──────────────────┐  │
                    │  │ Supabase │───►│ handle_new_user  │  │
                    │  │   Auth   │    │    trigger       │  │
                    │  └──────────┘    └────────┬─────────┘  │
                    │                           │            │
                    └───────────────────────────┼────────────┘
                                                │
                    ┌───────────────────────────┼────────────┐
                    │                           ▼            │
                    │  ┌──────────────────┐  ┌──────────┐   │
                    │  │  Grant credits   │  │  Create  │   │
                    │  │  (credit_ledger) │  │  profile │   │
                    │  └──────────────────┘  └──────────┘   │
                    │         BILLING            DATABASE    │
                    └────────────────────────────────────────┘
```

### Session Flow

```
1. User authenticates (magic link or OAuth)
2. Supabase creates session, sets cookies
3. Trigger fires: handle_new_user()
   - Creates profile row
   - Grants 10 trial credits
4. Auth callback claims any pending draft
5. Redirect to /app with session active
6. Middleware validates session on each protected request
```
