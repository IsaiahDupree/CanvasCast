-- =========================
-- GDP-011: Person Features Computation Functions
-- =========================
-- Creates SQL functions to compute person features from events:
-- - active_days: Number of unique days the person was active
-- - core_actions: Count of core value actions
-- - pricing_views: Count of pricing page views
-- - email_opens: Count of email open events
-- - last_activity_at: Most recent event timestamp

-- =========================
-- Function: compute_person_features
-- =========================
-- Computes all features for a specific person
CREATE OR REPLACE FUNCTION public.compute_person_features(target_person_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_active_days INTEGER;
  v_core_actions INTEGER;
  v_pricing_views INTEGER;
  v_email_opens INTEGER;
  v_last_activity_at TIMESTAMPTZ;
  v_person_exists BOOLEAN;
BEGIN
  -- Check if person exists
  SELECT EXISTS(SELECT 1 FROM public.person WHERE id = target_person_id)
  INTO v_person_exists;

  -- If person doesn't exist, skip computation
  IF NOT v_person_exists THEN
    RETURN;
  END IF;
  -- Compute active_days: number of unique days with events
  SELECT COUNT(DISTINCT DATE(occurred_at))
  INTO v_active_days
  FROM public.event
  WHERE person_id = target_person_id;

  -- Compute core_actions: count of core value events
  -- Core actions for CanvasCast: video_generated, video_downloaded, prompt_submitted
  SELECT COUNT(*)
  INTO v_core_actions
  FROM public.event
  WHERE person_id = target_person_id
    AND event_name IN ('video_generated', 'video_downloaded', 'prompt_submitted');

  -- Compute pricing_views: count of pricing_view events
  SELECT COUNT(*)
  INTO v_pricing_views
  FROM public.event
  WHERE person_id = target_person_id
    AND event_name = 'pricing_view';

  -- Compute email_opens: count of email open events
  -- Note: email_event doesn't have person_id, so we need to join through email_message
  SELECT COUNT(*)
  INTO v_email_opens
  FROM public.email_event ee
  JOIN public.email_message em ON ee.email_message_id = em.id
  WHERE em.person_id = target_person_id
    AND ee.event_type = 'opened';

  -- Compute last_activity_at: most recent event
  SELECT MAX(occurred_at)
  INTO v_last_activity_at
  FROM public.event
  WHERE person_id = target_person_id;

  -- Upsert person_features record
  INSERT INTO public.person_features (
    person_id,
    active_days,
    core_actions,
    pricing_views,
    email_opens,
    last_activity_at,
    computed_at
  )
  VALUES (
    target_person_id,
    COALESCE(v_active_days, 0),
    COALESCE(v_core_actions, 0),
    COALESCE(v_pricing_views, 0),
    COALESCE(v_email_opens, 0),
    v_last_activity_at,
    NOW()
  )
  ON CONFLICT (person_id)
  DO UPDATE SET
    active_days = EXCLUDED.active_days,
    core_actions = EXCLUDED.core_actions,
    pricing_views = EXCLUDED.pricing_views,
    email_opens = EXCLUDED.email_opens,
    last_activity_at = EXCLUDED.last_activity_at,
    computed_at = NOW();
END;
$$;

-- =========================
-- Function: compute_all_person_features
-- =========================
-- Computes features for all persons in the database
-- Useful for batch recomputation
CREATE OR REPLACE FUNCTION public.compute_all_person_features()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_person_record RECORD;
  v_count INTEGER := 0;
BEGIN
  -- Loop through all persons and compute features
  FOR v_person_record IN SELECT id FROM public.person
  LOOP
    PERFORM public.compute_person_features(v_person_record.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- =========================
-- Function: refresh_person_features_on_event
-- =========================
-- Trigger function to automatically recompute features when events are inserted
-- This keeps features up-to-date in real-time
CREATE OR REPLACE FUNCTION public.refresh_person_features_on_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Recompute features for the person
  PERFORM public.compute_person_features(NEW.person_id);
  RETURN NEW;
END;
$$;

-- =========================
-- Trigger: Auto-refresh features on event insert
-- =========================
-- Automatically recomputes person features when new events are added
DROP TRIGGER IF EXISTS trg_refresh_person_features_on_event ON public.event;
CREATE TRIGGER trg_refresh_person_features_on_event
AFTER INSERT ON public.event
FOR EACH ROW
EXECUTE FUNCTION public.refresh_person_features_on_event();

-- =========================
-- Function: refresh_person_features_on_email_event
-- =========================
-- Trigger function to automatically recompute features when email events are inserted
CREATE OR REPLACE FUNCTION public.refresh_person_features_on_email_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_person_id UUID;
BEGIN
  -- Get person_id from email_message
  SELECT person_id INTO v_person_id
  FROM public.email_message
  WHERE id = NEW.email_message_id;

  -- Only recompute if person_id is set
  IF v_person_id IS NOT NULL THEN
    PERFORM public.compute_person_features(v_person_id);
  END IF;
  RETURN NEW;
END;
$$;

-- =========================
-- Trigger: Auto-refresh features on email event insert
-- =========================
DROP TRIGGER IF EXISTS trg_refresh_person_features_on_email_event ON public.email_event;
CREATE TRIGGER trg_refresh_person_features_on_email_event
AFTER INSERT ON public.email_event
FOR EACH ROW
EXECUTE FUNCTION public.refresh_person_features_on_email_event();

-- =========================
-- Grant Permissions
-- =========================
GRANT EXECUTE ON FUNCTION public.compute_person_features(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.compute_all_person_features() TO anon, authenticated, service_role;

-- =========================
-- Comments
-- =========================
COMMENT ON FUNCTION public.compute_person_features(UUID) IS 'Computes all features for a specific person from events';
COMMENT ON FUNCTION public.compute_all_person_features() IS 'Batch computes features for all persons';
COMMENT ON FUNCTION public.refresh_person_features_on_event() IS 'Trigger function to auto-refresh features on event insert';
COMMENT ON FUNCTION public.refresh_person_features_on_email_event() IS 'Trigger function to auto-refresh features on email event insert';

-- =========================
-- Success Message
-- =========================
DO $$
BEGIN
  RAISE NOTICE 'Person features computation functions created successfully!';
  RAISE NOTICE 'Functions: compute_person_features(uuid), compute_all_person_features()';
  RAISE NOTICE 'Triggers: Auto-refresh on event and email_event inserts';
  RAISE NOTICE 'Features computed: active_days, core_actions, pricing_views, email_opens, last_activity_at';
END $$;
