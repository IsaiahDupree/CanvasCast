-- =========================
-- GDP-012: Segment Engine
-- =========================
-- SQL functions for evaluating segment membership and triggering automations
-- Part of the Growth Data Plane infrastructure for CanvasCast.

-- =========================
-- Table: segment_membership
-- =========================
-- Tracks which users are in which segments and when they entered/exited
CREATE TABLE IF NOT EXISTS public.segment_membership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES public.person(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL REFERENCES public.segment(id) ON DELETE CASCADE,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exited_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_segment_membership_person ON public.segment_membership(person_id);
CREATE INDEX IF NOT EXISTS idx_segment_membership_segment ON public.segment_membership(segment_id);
CREATE INDEX IF NOT EXISTS idx_segment_membership_active ON public.segment_membership(is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_segment_membership_person_segment_active
  ON public.segment_membership(person_id, segment_id)
  WHERE is_active = true;

-- RLS Policies
ALTER TABLE public.segment_membership ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "segment_membership_service_role" ON public.segment_membership;
CREATE POLICY "segment_membership_service_role"
ON public.segment_membership FOR ALL
USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE public.segment_membership IS 'Tracks segment membership over time';
COMMENT ON COLUMN public.segment_membership.is_active IS 'Whether the person is currently in this segment';

-- Grant permissions
GRANT ALL ON public.segment_membership TO anon, authenticated, service_role;

-- =========================
-- Function: parse_interval
-- =========================
-- Helper function to parse time window strings like "24h", "48h", "7d"
CREATE OR REPLACE FUNCTION public.parse_interval(time_window TEXT)
RETURNS INTERVAL
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  num INTEGER;
  unit TEXT;
BEGIN
  -- Extract number and unit (e.g., "24h" -> 24 and "h")
  num := substring(time_window FROM '^\d+')::INTEGER;
  unit := substring(time_window FROM '[a-z]+$');

  CASE unit
    WHEN 'h' THEN
      RETURN make_interval(hours => num);
    WHEN 'd' THEN
      RETURN make_interval(days => num);
    WHEN 'w' THEN
      RETURN make_interval(weeks => num);
    ELSE
      RETURN make_interval(days => 1); -- Default to 1 day
  END CASE;
END;
$$;

-- =========================
-- Function: evaluate_person_features_condition
-- =========================
-- Evaluates person_features conditions
CREATE OR REPLACE FUNCTION public.evaluate_person_features_condition(
  p_person_id UUID,
  p_conditions JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  features RECORD;
  condition_key TEXT;
  condition_value TEXT;
  operator TEXT;
  threshold INTEGER;
  actual_value INTEGER;
BEGIN
  -- Get person features
  SELECT * INTO features
  FROM public.person_features
  WHERE person_id = p_person_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Evaluate each condition
  FOR condition_key, condition_value IN SELECT * FROM jsonb_each_text(p_conditions)
  LOOP
    -- Parse operator and threshold (e.g., ">3" -> ">" and 3)
    operator := substring(condition_value FROM '^[<>=]+');
    threshold := substring(condition_value FROM '\d+')::INTEGER;

    -- Get actual value from features
    CASE condition_key
      WHEN 'active_days' THEN
        actual_value := features.active_days;
      WHEN 'core_actions' THEN
        actual_value := features.core_actions;
      WHEN 'pricing_views' THEN
        actual_value := features.pricing_views;
      WHEN 'email_opens' THEN
        actual_value := features.email_opens;
      ELSE
        CONTINUE;
    END CASE;

    -- Compare based on operator
    CASE operator
      WHEN '>' THEN
        IF NOT (actual_value > threshold) THEN
          RETURN false;
        END IF;
      WHEN '>=' THEN
        IF NOT (actual_value >= threshold) THEN
          RETURN false;
        END IF;
      WHEN '<' THEN
        IF NOT (actual_value < threshold) THEN
          RETURN false;
        END IF;
      WHEN '<=' THEN
        IF NOT (actual_value <= threshold) THEN
          RETURN false;
        END IF;
      WHEN '=' THEN
        IF NOT (actual_value = threshold) THEN
          RETURN false;
        END IF;
      ELSE
        RETURN false;
    END CASE;
  END LOOP;

  RETURN true;
END;
$$;

-- =========================
-- Function: evaluate_event_condition
-- =========================
-- Evaluates event-based conditions (event presence/absence within time window)
CREATE OR REPLACE FUNCTION public.evaluate_event_condition(
  p_person_id UUID,
  p_conditions JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_event_name TEXT;
  v_not_event_name TEXT;
  v_time_window TEXT;
  v_interval_duration INTERVAL;
  v_event_exists BOOLEAN;
BEGIN
  -- Extract conditions
  v_event_name := p_conditions->>'event';
  v_not_event_name := p_conditions->>'not_event';
  v_time_window := p_conditions->>'time_window';

  -- Parse time window
  IF v_time_window IS NOT NULL THEN
    v_interval_duration := public.parse_interval(v_time_window);
  ELSE
    v_interval_duration := make_interval(days => 30); -- Default 30 days
  END IF;

  -- Check if required event exists
  IF v_event_name IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.event e
      WHERE e.person_id = p_person_id
        AND e.event_name = v_event_name
        AND e.occurred_at >= NOW() - v_interval_duration
    ) INTO v_event_exists;

    IF NOT v_event_exists THEN
      RETURN false;
    END IF;
  END IF;

  -- Check that the "not_event" does NOT exist
  IF v_not_event_name IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.event e
      WHERE e.person_id = p_person_id
        AND e.event_name = v_not_event_name
        AND e.occurred_at >= NOW() - v_interval_duration
    ) INTO v_event_exists;

    IF v_event_exists THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$;

-- =========================
-- Function: evaluate_event_count_condition
-- =========================
-- Evaluates event_count conditions (e.g., pricing_view >= 2)
CREATE OR REPLACE FUNCTION public.evaluate_event_count_condition(
  p_person_id UUID,
  p_conditions JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  event_key TEXT;
  condition_value TEXT;
  operator TEXT;
  threshold INTEGER;
  actual_count INTEGER;
BEGIN
  -- Evaluate each event_count condition
  FOR event_key, condition_value IN SELECT * FROM jsonb_each_text(p_conditions)
  LOOP
    -- Parse operator and threshold (e.g., ">=2" -> ">=" and 2)
    operator := substring(condition_value FROM '^[<>=]+');
    threshold := substring(condition_value FROM '\d+')::INTEGER;

    -- Get actual event count
    SELECT COUNT(*) INTO actual_count
    FROM public.event e
    WHERE e.person_id = p_person_id
      AND e.event_name = event_key;

    -- Compare based on operator
    CASE operator
      WHEN '>' THEN
        IF NOT (actual_count > threshold) THEN
          RETURN false;
        END IF;
      WHEN '>=' THEN
        IF NOT (actual_count >= threshold) THEN
          RETURN false;
        END IF;
      WHEN '<' THEN
        IF NOT (actual_count < threshold) THEN
          RETURN false;
        END IF;
      WHEN '<=' THEN
        IF NOT (actual_count <= threshold) THEN
          RETURN false;
        END IF;
      WHEN '=' THEN
        IF NOT (actual_count = threshold) THEN
          RETURN false;
        END IF;
      ELSE
        RETURN false;
    END CASE;
  END LOOP;

  RETURN true;
END;
$$;

-- =========================
-- Function: evaluate_segment_membership
-- =========================
-- Main function to evaluate if a person matches a segment's conditions
CREATE OR REPLACE FUNCTION public.evaluate_segment_membership(
  p_segment_id UUID,
  p_person_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  segment_conditions JSONB;
  result BOOLEAN := true;
BEGIN
  -- Get segment conditions
  SELECT conditions INTO segment_conditions
  FROM public.segment
  WHERE id = p_segment_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Evaluate person_features conditions
  IF segment_conditions ? 'person_features' THEN
    result := public.evaluate_person_features_condition(
      p_person_id,
      segment_conditions->'person_features'
    );
    IF NOT result THEN
      RETURN false;
    END IF;
  END IF;

  -- Evaluate event-based conditions
  IF segment_conditions ? 'event' OR segment_conditions ? 'not_event' THEN
    result := public.evaluate_event_condition(
      p_person_id,
      segment_conditions
    );
    IF NOT result THEN
      RETURN false;
    END IF;
  END IF;

  -- Evaluate event_count conditions
  IF segment_conditions ? 'event_count' THEN
    result := public.evaluate_event_count_condition(
      p_person_id,
      segment_conditions->'event_count'
    );
    IF NOT result THEN
      RETURN false;
    END IF;
  END IF;

  RETURN result;
END;
$$;

-- =========================
-- Function: evaluate_person_segments
-- =========================
-- Evaluates all active segments for a person
CREATE OR REPLACE FUNCTION public.evaluate_person_segments(
  p_person_id UUID
)
RETURNS TABLE (
  segment_id UUID,
  segment_name TEXT,
  matches BOOLEAN
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    public.evaluate_segment_membership(s.id, p_person_id)
  FROM public.segment s
  WHERE s.is_active = true;
END;
$$;

-- =========================
-- Function: trigger_segment_automation
-- =========================
-- Triggers automation actions when a person enters a segment
CREATE OR REPLACE FUNCTION public.trigger_segment_automation(
  p_segment_id UUID,
  p_person_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  automation_cfg JSONB;
  person_email TEXT;
  result JSONB;
  actions TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Get segment automation config
  SELECT automation_config INTO automation_cfg
  FROM public.segment
  WHERE id = p_segment_id;

  IF automation_cfg IS NULL OR automation_cfg = '{}'::jsonb THEN
    RETURN jsonb_build_object(
      'automation_triggered', false,
      'reason', 'no_automation_config'
    );
  END IF;

  -- Get person email
  SELECT email INTO person_email
  FROM public.person
  WHERE id = p_person_id;

  -- Handle email automation
  IF automation_cfg ? 'email_template' THEN
    -- In a real implementation, this would queue an email job
    -- For now, we'll just track that it should be queued
    actions := array_append(actions, 'email_queued');
  END IF;

  -- Handle Meta audience automation
  IF automation_cfg ? 'meta_audience' THEN
    -- In a real implementation, this would add the person to a Meta custom audience
    -- For now, we'll just track that it should be added
    actions := array_append(actions, 'meta_audience_added');
  END IF;

  -- Handle outbound automation
  IF automation_cfg ? 'outbound_campaign' THEN
    actions := array_append(actions, 'outbound_triggered');
  END IF;

  result := jsonb_build_object(
    'automation_triggered', true,
    'segment_id', p_segment_id,
    'person_id', p_person_id,
    'actions', actions,
    'config', automation_cfg
  );

  RETURN result;
END;
$$;

-- =========================
-- Function: update_segment_memberships
-- =========================
-- Updates segment memberships for a person (enters/exits segments)
CREATE OR REPLACE FUNCTION public.update_segment_memberships(
  p_person_id UUID
)
RETURNS TABLE (
  segment_id UUID,
  action TEXT,
  automation_result JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  segment_rec RECORD;
  matches BOOLEAN;
  is_member BOOLEAN;
  membership_id UUID;
  automation JSONB;
BEGIN
  FOR segment_rec IN
    SELECT id, name FROM public.segment WHERE is_active = true
  LOOP
    -- Evaluate if person matches this segment
    matches := public.evaluate_segment_membership(segment_rec.id, p_person_id);

    -- Check if person is already a member
    SELECT EXISTS (
      SELECT 1 FROM public.segment_membership
      WHERE person_id = p_person_id
        AND segment_id = segment_rec.id
        AND is_active = true
    ) INTO is_member;

    -- Handle segment entry
    IF matches AND NOT is_member THEN
      INSERT INTO public.segment_membership (person_id, segment_id, entered_at, is_active)
      VALUES (p_person_id, segment_rec.id, NOW(), true)
      RETURNING id INTO membership_id;

      -- Trigger automation
      automation := public.trigger_segment_automation(segment_rec.id, p_person_id);

      RETURN QUERY SELECT segment_rec.id, 'entered'::TEXT, automation;

    -- Handle segment exit
    ELSIF NOT matches AND is_member THEN
      UPDATE public.segment_membership
      SET is_active = false, exited_at = NOW()
      WHERE person_id = p_person_id
        AND segment_id = segment_rec.id
        AND is_active = true;

      RETURN QUERY SELECT segment_rec.id, 'exited'::TEXT, NULL::JSONB;
    END IF;
  END LOOP;
END;
$$;

-- =========================
-- Grant Permissions
-- =========================
GRANT EXECUTE ON FUNCTION public.parse_interval(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.evaluate_person_features_condition(UUID, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.evaluate_event_condition(UUID, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.evaluate_event_count_condition(UUID, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.evaluate_segment_membership(UUID, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.evaluate_person_segments(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.trigger_segment_automation(UUID, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_segment_memberships(UUID) TO anon, authenticated, service_role;

-- =========================
-- Success Message
-- =========================
DO $$
BEGIN
  RAISE NOTICE 'GDP-012: Segment Engine created successfully!';
  RAISE NOTICE 'Tables: segment_membership';
  RAISE NOTICE 'Functions: evaluate_segment_membership, evaluate_person_segments, trigger_segment_automation, update_segment_memberships';
  RAISE NOTICE 'Helper functions: parse_interval, evaluate_person_features_condition, evaluate_event_condition, evaluate_event_count_condition';
END $$;
