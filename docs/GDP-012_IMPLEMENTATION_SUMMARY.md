# GDP-012: Segment Engine Implementation Summary

## Overview
Implemented a complete segment engine that evaluates user segment membership and triggers automations for email campaigns, Meta custom audiences, and outbound marketing.

## Implementation Date
January 26, 2026

## What Was Built

### 1. Database Schema
**File**: `supabase/migrations/20260126000005_segment_engine.sql`

#### New Table: `segment_membership`
Tracks which users are in which segments over time.

**Columns**:
- `id` (UUID): Primary key
- `person_id` (UUID): References person table
- `segment_id` (UUID): References segment table
- `entered_at` (TIMESTAMPTZ): When user entered segment
- `exited_at` (TIMESTAMPTZ): When user exited segment (nullable)
- `is_active` (BOOLEAN): Whether user is currently in segment
- `created_at` (TIMESTAMPTZ): Record creation time

**Indexes**:
- `idx_segment_membership_person`: Fast lookups by person
- `idx_segment_membership_segment`: Fast lookups by segment
- `idx_segment_membership_active`: Filter active memberships
- `idx_segment_membership_person_segment_active`: Unique constraint for active memberships

### 2. Core Functions

#### Helper Functions

**`parse_interval(time_window TEXT)`**
- Converts time window strings ("24h", "48h", "7d") to PostgreSQL intervals
- Supports hours (h), days (d), and weeks (w)

**`evaluate_person_features_condition(p_person_id UUID, p_conditions JSONB)`**
- Evaluates conditions based on computed person features
- Supports operators: `>`, `>=`, `<`, `<=`, `=`
- Checks: `active_days`, `core_actions`, `pricing_views`, `email_opens`

**`evaluate_event_condition(p_person_id UUID, p_conditions JSONB)`**
- Evaluates event presence/absence within time windows
- Checks if required events exist
- Checks if forbidden events do NOT exist
- Time window scoped evaluation

**`evaluate_event_count_condition(p_person_id UUID, p_conditions JSONB)`**
- Evaluates event count conditions (e.g., "pricing_view >= 2")
- Supports all comparison operators
- Counts events across all time

#### Main Functions

**`evaluate_segment_membership(p_segment_id UUID, p_person_id UUID)`**
- Main entry point for segment evaluation
- Returns boolean: whether person matches segment conditions
- Handles all three condition types:
  - `person_features`: Computed behavioral features
  - `event` / `not_event`: Event presence/absence
  - `event_count`: Event frequency thresholds

**`evaluate_person_segments(p_person_id UUID)`**
- Evaluates all active segments for a person
- Returns table with segment details and match status
- Only processes segments with `is_active = true`

**`trigger_segment_automation(p_segment_id UUID, p_person_id UUID)`**
- Triggers automation actions when person enters segment
- Returns JSONB with triggered actions
- Supported automations:
  - Email campaigns (via `email_template`)
  - Meta custom audiences (via `meta_audience`)
  - Outbound campaigns (via `outbound_campaign`)

**`update_segment_memberships(p_person_id UUID)`**
- Updates all segment memberships for a person
- Handles segment entry (creates membership record)
- Handles segment exit (marks membership inactive)
- Automatically triggers automations on entry
- Returns table of all membership changes

### 3. Test Coverage
**File**: `__tests__/database/gdp-012-segment-engine.test.ts`

**Test Suites** (13 tests, all passing):

1. **Segment Membership Evaluation** (4 tests)
   - Evaluates person_features conditions
   - Returns false when conditions don't match
   - Evaluates event-based conditions
   - Evaluates event_count conditions

2. **Batch Segment Evaluation** (2 tests)
   - Evaluates all active segments for a person
   - Only evaluates active segments

3. **Automation Triggers** (3 tests)
   - Triggers automation when person enters segment
   - Queues email automation
   - Adds person to Meta custom audience

4. **Segment Membership Table** (2 tests)
   - Tracks segment membership over time
   - Exits person from segment when conditions no longer match

5. **Default CanvasCast Segments** (2 tests)
   - Verifies default segments are installed
   - Tests signup_no_prompt_24h segment logic

## Default Segments Installed

The migration includes 5 pre-configured segments for CanvasCast:

1. **signup_no_prompt_24h**
   - Users who signed up but didn't submit a prompt in 24 hours
   - Triggers: "first_video_nudge" email after 24 hours

2. **video_generated_no_download_48h**
   - Users who generated a video but didn't download in 48 hours
   - Triggers: "download_reminder" email after 48 hours

3. **low_credits_high_usage**
   - Active users (3+ active days, 2+ core actions) with <5 credits
   - Triggers: "credit_topup" email on low credits

4. **pricing_viewed_2plus_not_paid**
   - Users who viewed pricing 2+ times without purchasing
   - Triggers: "pricing_followup" email + Meta "pricing_interested" audience

5. **demo_watched_not_signed_up**
   - Visitors who watched demo but didn't sign up within 7 days
   - Triggers: "demo_to_signup" email after 24 hours

## Condition Types Supported

### 1. Person Features Conditions
```json
{
  "person_features": {
    "active_days": ">3",
    "core_actions": ">2",
    "pricing_views": ">=2",
    "email_opens": ">=4"
  }
}
```

### 2. Event-Based Conditions
```json
{
  "event": "video_generated",
  "not_event": "video_downloaded",
  "time_window": "48h"
}
```

### 3. Event Count Conditions
```json
{
  "event_count": {
    "pricing_view": ">=2",
    "video_created": ">5"
  }
}
```

## Automation Configuration

Segments can trigger multiple automation types:

```json
{
  "email_template": "template_name",
  "delay_hours": 24,
  "meta_audience": "audience_name",
  "outbound_campaign": "campaign_id"
}
```

## Usage Examples

### Check if User Matches a Segment
```sql
SELECT public.evaluate_segment_membership(
  'segment-uuid-here',
  'person-uuid-here'
);
-- Returns: true or false
```

### Evaluate All Segments for a User
```sql
SELECT * FROM public.evaluate_person_segments('person-uuid-here');
-- Returns table with: segment_id, segment_name, matches
```

### Trigger Automation for Segment Entry
```sql
SELECT public.trigger_segment_automation(
  'segment-uuid-here',
  'person-uuid-here'
);
-- Returns: JSONB with automation details
```

### Update All Segment Memberships
```sql
SELECT * FROM public.update_segment_memberships('person-uuid-here');
-- Returns table with: segment_id, action ('entered'/'exited'), automation_result
```

## Integration Points

### When to Call Segment Engine

1. **After User Events**: When significant events occur
   - After signup completion
   - After video generation
   - After pricing page view
   - After email opens/clicks

2. **After Feature Computation**: When person_features are updated
   - After `compute_person_features()` runs
   - On daily/hourly scheduled jobs

3. **Manual Triggers**: Admin tools
   - Re-evaluate specific users
   - Re-sync segment memberships
   - Test segment conditions

### Automation Handlers (To Be Implemented)

The segment engine identifies which automations should fire, but the actual execution should be handled by:

1. **Email Queue Worker**: Process `email_template` actions
   - Read from automation results
   - Queue Resend email jobs
   - Apply delay_hours if specified

2. **Meta Sync Worker**: Process `meta_audience` actions
   - Add person to Meta Custom Audience via API
   - Remove from audience on segment exit

3. **Outbound Worker**: Process `outbound_campaign` actions
   - Trigger outbound sequences
   - Log campaign interactions

## Performance Considerations

1. **Batch Processing**: Use `evaluate_person_segments()` to evaluate all segments at once
2. **Indexing**: All key columns are indexed for fast lookups
3. **Active Segments Only**: Only active segments are evaluated
4. **Time Window Scoping**: Event queries are scoped to relevant time windows

## Next Steps

1. **Scheduled Jobs**: Create cron jobs to periodically update segment memberships
2. **Automation Workers**: Implement workers to execute automation actions
3. **Segment Builder UI**: Admin interface to create/edit segments
4. **Analytics Dashboard**: Track segment performance and conversion rates
5. **A/B Testing**: Support variant segments for experimentation

## Files Changed

1. `supabase/migrations/20260126000005_segment_engine.sql` - New migration
2. `__tests__/database/gdp-012-segment-engine.test.ts` - New test file
3. `feature_list.json` - Marked GDP-012 as complete (174/175 features)
4. `docs/GDP-012_IMPLEMENTATION_SUMMARY.md` - This file

## Test Results

```
✓ GDP-012: Segment Engine (13 tests) 296ms
  ✓ Segment Membership Evaluation (4 tests)
  ✓ Batch Segment Evaluation (2 tests)
  ✓ Automation Triggers (3 tests)
  ✓ Segment Membership Table (2 tests)
  ✓ Default CanvasCast Segments (2 tests)

Test Files: 1 passed (1)
Tests: 13 passed (13)
```

## Conclusion

The Segment Engine (GDP-012) is now fully implemented and tested. All 13 tests pass, providing comprehensive coverage of:
- Segment membership evaluation
- Condition type handling (features, events, event counts)
- Automation triggering
- Membership tracking
- Default segment definitions

The implementation follows TDD principles with a RED-GREEN-REFACTOR cycle, resulting in robust, well-tested code.
