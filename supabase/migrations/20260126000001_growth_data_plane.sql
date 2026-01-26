-- =========================
-- GDP-001: Growth Data Plane Schema Setup
-- =========================
-- Creates tables for unified person tracking, identity linking, events,
-- email tracking, subscriptions, deals, person features, and segments.
-- Part of the Growth Data Plane infrastructure for CanvasCast.

-- =========================
-- Helper Functions
-- =========================

-- Function to get table columns (for testing)
CREATE OR REPLACE FUNCTION public.get_table_columns(table_name TEXT)
RETURNS TABLE (
  column_name TEXT,
  data_type TEXT,
  is_nullable TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.column_name::TEXT,
    c.data_type::TEXT,
    c.is_nullable::TEXT
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = get_table_columns.table_name
  ORDER BY c.ordinal_position;
END;
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =========================
-- Table: person
-- =========================
-- Canonical person record that consolidates all identity sources
CREATE TABLE IF NOT EXISTS public.person (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  properties JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_person_email ON public.person(email);
CREATE INDEX IF NOT EXISTS idx_person_created_at ON public.person(created_at);

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_person_updated_at ON public.person;
CREATE TRIGGER trg_person_updated_at
BEFORE UPDATE ON public.person
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS Policies
ALTER TABLE public.person ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "person_service_role" ON public.person;
CREATE POLICY "person_service_role"
ON public.person FOR ALL
USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE public.person IS 'Canonical person/user record for growth tracking';
COMMENT ON COLUMN public.person.email IS 'Primary email address';
COMMENT ON COLUMN public.person.properties IS 'Additional user properties in JSONB format';

-- =========================
-- Table: identity_link
-- =========================
-- Links person to external identities (posthog, stripe, meta, etc.)
CREATE TABLE IF NOT EXISTS public.identity_link (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES public.person(id) ON DELETE CASCADE,
  source TEXT NOT NULL, -- posthog, stripe, meta, resend
  external_id TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_identity_link_unique ON public.identity_link(source, external_id);
CREATE INDEX IF NOT EXISTS idx_identity_link_person ON public.identity_link(person_id);
CREATE INDEX IF NOT EXISTS idx_identity_link_source ON public.identity_link(source);

-- RLS Policies
ALTER TABLE public.identity_link ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "identity_link_service_role" ON public.identity_link;
CREATE POLICY "identity_link_service_role"
ON public.identity_link FOR ALL
USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE public.identity_link IS 'Links person to external identity systems';
COMMENT ON COLUMN public.identity_link.source IS 'Identity source: posthog, stripe, meta, resend';
COMMENT ON COLUMN public.identity_link.external_id IS 'External system ID';

-- =========================
-- Table: event
-- =========================
-- Unified event tracking from all sources
CREATE TABLE IF NOT EXISTS public.event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID REFERENCES public.person(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  event_source TEXT NOT NULL, -- web, app, email, stripe, booking, meta
  properties JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_event_person ON public.event(person_id);
CREATE INDEX IF NOT EXISTS idx_event_name ON public.event(event_name);
CREATE INDEX IF NOT EXISTS idx_event_source ON public.event(event_source);
CREATE INDEX IF NOT EXISTS idx_event_occurred_at ON public.event(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_person_occurred ON public.event(person_id, occurred_at DESC);

-- RLS Policies
ALTER TABLE public.event ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_service_role" ON public.event;
CREATE POLICY "event_service_role"
ON public.event FOR ALL
USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE public.event IS 'Unified event stream from all sources';
COMMENT ON COLUMN public.event.event_source IS 'Source: web, app, email, stripe, booking, meta';
COMMENT ON COLUMN public.event.properties IS 'Event properties in JSONB format';
COMMENT ON COLUMN public.event.occurred_at IS 'When the event actually happened';

-- =========================
-- Table: email_message
-- =========================
-- Tracks email messages sent via Resend
CREATE TABLE IF NOT EXISTS public.email_message (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID REFERENCES public.person(id) ON DELETE SET NULL,
  resend_email_id TEXT UNIQUE,
  subject TEXT,
  to_address TEXT NOT NULL,
  from_address TEXT NOT NULL,
  tags JSONB DEFAULT '[]'::jsonb,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_message_person ON public.email_message(person_id);
CREATE INDEX IF NOT EXISTS idx_email_message_resend ON public.email_message(resend_email_id);
CREATE INDEX IF NOT EXISTS idx_email_message_sent_at ON public.email_message(sent_at DESC);

-- RLS Policies
ALTER TABLE public.email_message ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_message_service_role" ON public.email_message;
CREATE POLICY "email_message_service_role"
ON public.email_message FOR ALL
USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE public.email_message IS 'Email messages sent via Resend';
COMMENT ON COLUMN public.email_message.resend_email_id IS 'Resend email ID for tracking';
COMMENT ON COLUMN public.email_message.tags IS 'Email tags for categorization';

-- =========================
-- Table: email_event
-- =========================
-- Tracks email delivery events from Resend webhooks
CREATE TABLE IF NOT EXISTS public.email_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_message_id UUID REFERENCES public.email_message(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- delivered, opened, clicked, bounced, complained
  link_url TEXT,
  user_agent TEXT,
  ip_address TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_event_message ON public.email_event(email_message_id);
CREATE INDEX IF NOT EXISTS idx_email_event_type ON public.email_event(event_type);
CREATE INDEX IF NOT EXISTS idx_email_event_occurred_at ON public.email_event(occurred_at DESC);

-- RLS Policies
ALTER TABLE public.email_event ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_event_service_role" ON public.email_event;
CREATE POLICY "email_event_service_role"
ON public.email_event FOR ALL
USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE public.email_event IS 'Email delivery and engagement events from Resend';
COMMENT ON COLUMN public.email_event.event_type IS 'Event type: delivered, opened, clicked, bounced, complained';

-- =========================
-- Table: subscription
-- =========================
-- Subscription snapshot from Stripe
CREATE TABLE IF NOT EXISTS public.subscription (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES public.person(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL, -- active, canceled, past_due, trialing
  plan_name TEXT,
  plan_id TEXT,
  mrr DECIMAL(10, 2) DEFAULT 0,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscription_person ON public.subscription(person_id);
CREATE INDEX IF NOT EXISTS idx_subscription_stripe ON public.subscription(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_status ON public.subscription(status);

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_subscription_updated_at ON public.subscription;
CREATE TRIGGER trg_subscription_updated_at
BEFORE UPDATE ON public.subscription
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS Policies
ALTER TABLE public.subscription ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscription_service_role" ON public.subscription;
CREATE POLICY "subscription_service_role"
ON public.subscription FOR ALL
USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE public.subscription IS 'Subscription snapshot from Stripe';
COMMENT ON COLUMN public.subscription.mrr IS 'Monthly recurring revenue';

-- =========================
-- Table: deal
-- =========================
-- Sales pipeline tracking
CREATE TABLE IF NOT EXISTS public.deal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES public.person(id) ON DELETE CASCADE,
  stage TEXT NOT NULL, -- lead, qualified, proposal, negotiation, won, lost
  value DECIMAL(10, 2) DEFAULT 0,
  source TEXT,
  notes TEXT,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deal_person ON public.deal(person_id);
CREATE INDEX IF NOT EXISTS idx_deal_stage ON public.deal(stage);
CREATE INDEX IF NOT EXISTS idx_deal_created_at ON public.deal(created_at DESC);

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_deal_updated_at ON public.deal;
CREATE TRIGGER trg_deal_updated_at
BEFORE UPDATE ON public.deal
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS Policies
ALTER TABLE public.deal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deal_service_role" ON public.deal;
CREATE POLICY "deal_service_role"
ON public.deal FOR ALL
USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE public.deal IS 'Sales pipeline tracking';
COMMENT ON COLUMN public.deal.stage IS 'Pipeline stage: lead, qualified, proposal, negotiation, won, lost';

-- =========================
-- Table: person_features
-- =========================
-- Computed features for segmentation and personalization
CREATE TABLE IF NOT EXISTS public.person_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES public.person(id) ON DELETE CASCADE,
  active_days INTEGER DEFAULT 0,
  core_actions INTEGER DEFAULT 0,
  pricing_views INTEGER DEFAULT 0,
  email_opens INTEGER DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_person_features_person ON public.person_features(person_id);
CREATE INDEX IF NOT EXISTS idx_person_features_computed_at ON public.person_features(computed_at DESC);

-- RLS Policies
ALTER TABLE public.person_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "person_features_service_role" ON public.person_features;
CREATE POLICY "person_features_service_role"
ON public.person_features FOR ALL
USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE public.person_features IS 'Computed features for segmentation';
COMMENT ON COLUMN public.person_features.active_days IS 'Number of days user was active';
COMMENT ON COLUMN public.person_features.core_actions IS 'Count of core value actions';

-- =========================
-- Table: segment
-- =========================
-- Segment definitions and conditions
CREATE TABLE IF NOT EXISTS public.segment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  conditions JSONB NOT NULL, -- SQL/JSONB conditions for membership
  automation_config JSONB DEFAULT '{}'::jsonb, -- What to trigger
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_segment_name ON public.segment(name);
CREATE INDEX IF NOT EXISTS idx_segment_active ON public.segment(is_active);

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_segment_updated_at ON public.segment;
CREATE TRIGGER trg_segment_updated_at
BEFORE UPDATE ON public.segment
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS Policies
ALTER TABLE public.segment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "segment_service_role" ON public.segment;
CREATE POLICY "segment_service_role"
ON public.segment FOR ALL
USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE public.segment IS 'Segment definitions for automated campaigns';
COMMENT ON COLUMN public.segment.conditions IS 'JSONB conditions for segment membership';
COMMENT ON COLUMN public.segment.automation_config IS 'Automation triggers (email, meta, etc.)';

-- =========================
-- Insert Default Segments for CanvasCast
-- =========================
INSERT INTO public.segment (name, description, conditions, automation_config) VALUES
  (
    'signup_no_prompt_24h',
    'Users who signed up but did not submit a prompt in 24 hours',
    '{"event": "signup_completed", "not_event": "prompt_submitted", "time_window": "24h"}'::jsonb,
    '{"email_template": "first_video_nudge", "delay_hours": 24}'::jsonb
  ),
  (
    'video_generated_no_download_48h',
    'Users who generated a video but did not download it in 48 hours',
    '{"event": "video_generated", "not_event": "video_downloaded", "time_window": "48h"}'::jsonb,
    '{"email_template": "download_reminder", "delay_hours": 48}'::jsonb
  ),
  (
    'low_credits_high_usage',
    'Active users with low credits',
    '{"person_features": {"active_days": ">3", "core_actions": ">2"}, "credits": "<5"}'::jsonb,
    '{"email_template": "credit_topup", "trigger": "on_low_credits"}'::jsonb
  ),
  (
    'pricing_viewed_2plus_not_paid',
    'Users who viewed pricing 2+ times without purchasing',
    '{"event_count": {"pricing_view": ">=2"}, "not_event": "credits_purchased"}'::jsonb,
    '{"email_template": "pricing_followup", "meta_audience": "pricing_interested"}'::jsonb
  ),
  (
    'demo_watched_not_signed_up',
    'Visitors who watched demo video but did not sign up',
    '{"event": "demo_video_played", "not_event": "signup_completed", "time_window": "7d"}'::jsonb,
    '{"email_template": "demo_to_signup", "delay_hours": 24}'::jsonb
  )
ON CONFLICT (name) DO NOTHING;

-- =========================
-- Grant Permissions
-- =========================
-- Grant access to all Growth Data Plane tables for Supabase roles
GRANT ALL ON public.person TO anon, authenticated, service_role;
GRANT ALL ON public.identity_link TO anon, authenticated, service_role;
GRANT ALL ON public.event TO anon, authenticated, service_role;
GRANT ALL ON public.email_message TO anon, authenticated, service_role;
GRANT ALL ON public.email_event TO anon, authenticated, service_role;
GRANT ALL ON public.subscription TO anon, authenticated, service_role;
GRANT ALL ON public.deal TO anon, authenticated, service_role;
GRANT ALL ON public.person_features TO anon, authenticated, service_role;
GRANT ALL ON public.segment TO anon, authenticated, service_role;

-- Grant execute on helper function
GRANT EXECUTE ON FUNCTION public.get_table_columns(TEXT) TO anon, authenticated, service_role;

-- =========================
-- Success Message
-- =========================
DO $$
BEGIN
  RAISE NOTICE 'Growth Data Plane schema created successfully!';
  RAISE NOTICE 'Tables: person, identity_link, event, email_message, email_event, subscription, deal, person_features, segment';
  RAISE NOTICE 'Default segments inserted: 5 CanvasCast-specific segments';
  RAISE NOTICE 'Permissions granted to anon, authenticated, service_role';
END $$;
