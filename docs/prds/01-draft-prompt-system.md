# PRD: Draft/Prompt System (Pre-Auth Flow)

**Subsystem:** Draft Management  
**Version:** 1.0  
**Status:** Implemented  
**Owner:** Isaiah  

---

## 1. Overview

The Draft/Prompt System enables anonymous users to submit video ideas before creating an account. This reduces friction in the conversion funnel by capturing user intent immediately, then gating signup only when they want to see results.

### Business Goal
Convert cold traffic into signups by letting users commit to their idea before asking for credentials.

---

## 2. User Stories

### US-1: Anonymous Prompt Submission
**As a** new visitor  
**I want to** enter my video idea without signing up  
**So that** I can see if the product works before committing

### US-2: Draft Restoration After Signup
**As a** user who just signed up  
**I want to** see my prompt already filled in  
**So that** I don't have to re-enter my idea

### US-3: Draft Expiration
**As a** system administrator  
**I want** unclaimed drafts to expire after 7 days  
**So that** the database doesn't grow unbounded

---

## 3. Functional Requirements

### FR-1: Create Draft (Pre-Auth)

**Endpoint:** `POST /api/draft`

**Request:**
```json
{
  "promptText": "Create a motivational video about...",
  "templateId": "narrated_storyboard_v1",
  "options": {}
}
```

**Response:**
```json
{
  "draftId": "uuid",
  "sessionToken": "uuid",
  "isAuthenticated": false
}
```

**Behavior:**
1. Generate session token if not present in cookies
2. Store draft in `draft_prompts` table
3. Set `draft_session` cookie (7-day expiry)
4. Return draft ID for redirect

### FR-2: Retrieve Draft

**Endpoint:** `GET /api/draft`

**Response:**
```json
{
  "draft": {
    "id": "uuid",
    "promptText": "...",
    "templateId": "narrated_storyboard_v1",
    "options": {},
    "createdAt": "2026-01-17T..."
  }
}
```

**Lookup Priority:**
1. If authenticated: find by `claimed_by_user_id`
2. If not authenticated: find by `session_token` from cookie

### FR-3: Claim Draft on Signup

**Trigger:** User completes authentication

**Behavior:**
1. Call `claim_draft_prompt(session_token, user_id)`
2. Update `claimed_by_user_id` to authenticated user
3. Redirect to `/app/new?draft={draftId}`

### FR-4: Upsert Behavior

If user submits multiple prompts in same session:
- Update existing draft (most recent wins)
- Keep `session_token` stable

---

## 4. Data Model

### Table: `draft_prompts`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, auto-generated |
| `session_token` | TEXT | NOT NULL, indexed |
| `prompt_text` | TEXT | NOT NULL, min 10 chars |
| `template_id` | TEXT | DEFAULT 'narrated_storyboard_v1' |
| `options_json` | JSONB | DEFAULT '{}' |
| `claimed_by_user_id` | UUID | FK → auth.users, nullable |
| `expires_at` | TIMESTAMPTZ | DEFAULT NOW() + 7 days |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() |

### Indexes
- `idx_draft_prompts_session_token` - Fast lookup by session
- `idx_draft_prompts_expires_at` - Cleanup query optimization

### RLS Policies
- **Insert:** Anyone can create drafts
- **Select:** Users can read their claimed drafts OR unclaimed drafts (via session)
- **Update:** Users can update their claimed drafts

---

## 5. Security Considerations

### Session Token Security
- HTTP-only cookie prevents XSS theft
- Secure flag in production
- SameSite=Lax prevents CSRF

### Rate Limiting
- Max 10 drafts per IP per hour
- Max 100 characters for prompt text validation

### Privacy
- Unclaimed drafts are not linked to any user
- Expired drafts are deleted (no personal data retention)

---

## 6. Edge Cases

| Scenario | Behavior |
|----------|----------|
| User clears cookies | Draft lost (acceptable) |
| User uses different device | Draft not available (acceptable) |
| User submits empty prompt | Validation error (min 10 chars) |
| Draft already claimed | Return existing draft |
| Expired draft | Not returned, treated as new user |

---

## 7. Cleanup Function

```sql
CREATE OR REPLACE FUNCTION cleanup_expired_drafts() RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM draft_prompts
  WHERE expires_at < NOW() AND claimed_by_user_id IS NULL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
```

**Scheduling:** Run daily via cron or Supabase scheduled function.

---

## 8. Metrics

| Metric | Description |
|--------|-------------|
| `drafts_created` | Total drafts submitted |
| `drafts_claimed` | Drafts converted to signups |
| `drafts_expired` | Drafts cleaned up |
| `claim_rate` | `claimed / created` |
| `time_to_claim` | Avg time from draft to signup |

---

## 9. Files

| File | Purpose |
|------|---------|
| `apps/web/src/app/api/draft/route.ts` | API handler |
| `apps/web/src/components/prompt-input.tsx` | UI component |
| `supabase/migrations/20260118000000_draft_prompts_job_steps.sql` | Schema |

---

## 10. System Integration

### Communicates With

| Subsystem | Direction | Mechanism | Purpose |
|-----------|-----------|-----------|---------|
| **Auth** | Draft → Auth | DB function | Claim draft on signup |
| **Frontend** | Frontend → Draft | REST API | Submit/retrieve prompts |
| **Database** | Draft ↔ DB | Supabase client | CRUD operations |

### Inbound Interfaces

```typescript
// From Frontend: Create draft
POST /api/draft
Request: { promptText: string, templateId?: string, options?: object }
Response: { draftId: string, sessionToken: string, isAuthenticated: boolean }

// From Frontend: Get draft
GET /api/draft
Response: { draft: DraftPrompt | null }
```

### Outbound Interfaces

```typescript
// To Auth: Claim draft after signup
await supabase.rpc('claim_draft_prompt', {
  p_session_token: sessionToken,
  p_user_id: userId
});
// Returns: draftId or null
```

### Data Dependencies

| Depends On | Data Needed | How Retrieved |
|------------|-------------|---------------|
| None | - | Draft is self-contained |

### Provides To

| Consumer | Data Provided | How Delivered |
|----------|---------------|---------------|
| Auth | Draft to claim | RPC function |
| Project Creation | Prompt text | Query by user_id |

### Integration Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                        DRAFT SUBSYSTEM                        │
│                                                              │
│  ┌──────────────┐                      ┌─────────────────┐   │
│  │   /api/draft │◄───── Cookie ───────│  Session Token  │   │
│  │   REST API   │                      │   (HTTP-only)   │   │
│  └──────┬───────┘                      └─────────────────┘   │
│         │                                                     │
│         ▼                                                     │
│  ┌──────────────┐                                            │
│  │ draft_prompts│                                            │
│  │    table     │                                            │
│  └──────┬───────┘                                            │
│         │                                                     │
└─────────┼────────────────────────────────────────────────────┘
          │
          │ claim_draft_prompt(session_token, user_id)
          ▼
┌──────────────────────────────────────────────────────────────┐
│                        AUTH SUBSYSTEM                         │
│  On signup → Claim draft → Link to user → Redirect           │
└──────────────────────────────────────────────────────────────┘
