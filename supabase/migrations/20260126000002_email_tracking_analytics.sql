-- =========================
-- GDP-005: Email Event Tracking Analytics
-- =========================
-- RPC functions for analyzing email delivery, engagement, and bounce events
-- These functions aggregate data from email_message and email_event tables

-- =========================
-- Function: get_email_metrics_for_person
-- =========================
-- Returns comprehensive email metrics for a specific person
CREATE OR REPLACE FUNCTION public.get_email_metrics_for_person(p_person_id UUID)
RETURNS TABLE (
  total_sent BIGINT,
  delivered_count BIGINT,
  delivery_rate NUMERIC,
  bounced_count BIGINT,
  bounce_rate NUMERIC,
  opened_count BIGINT,
  open_rate NUMERIC,
  clicked_count BIGINT,
  click_rate NUMERIC,
  click_to_open_rate NUMERIC,
  complained_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH email_stats AS (
    SELECT
      em.id,
      EXISTS(
        SELECT 1 FROM email_event ee
        WHERE ee.email_message_id = em.id AND ee.event_type = 'delivered'
      ) as is_delivered,
      EXISTS(
        SELECT 1 FROM email_event ee
        WHERE ee.email_message_id = em.id AND ee.event_type = 'opened'
      ) as is_opened,
      EXISTS(
        SELECT 1 FROM email_event ee
        WHERE ee.email_message_id = em.id AND ee.event_type = 'clicked'
      ) as is_clicked,
      EXISTS(
        SELECT 1 FROM email_event ee
        WHERE ee.email_message_id = em.id AND ee.event_type = 'bounced'
      ) as is_bounced,
      EXISTS(
        SELECT 1 FROM email_event ee
        WHERE ee.email_message_id = em.id AND ee.event_type = 'complained'
      ) as is_complained
    FROM email_message em
    WHERE em.person_id = p_person_id
  ),
  aggregated AS (
    SELECT
      COUNT(*)::BIGINT as total_sent,
      COUNT(*) FILTER (WHERE is_delivered)::BIGINT as delivered_count,
      COUNT(*) FILTER (WHERE is_bounced)::BIGINT as bounced_count,
      COUNT(*) FILTER (WHERE is_opened)::BIGINT as opened_count,
      COUNT(*) FILTER (WHERE is_clicked)::BIGINT as clicked_count,
      COUNT(*) FILTER (WHERE is_complained)::BIGINT as complained_count
    FROM email_stats
  )
  SELECT
    agg.total_sent,
    agg.delivered_count,
    CASE
      WHEN agg.total_sent > 0 THEN ROUND((agg.delivered_count::NUMERIC / agg.total_sent::NUMERIC) * 100, 2)
      ELSE 0
    END as delivery_rate,
    agg.bounced_count,
    CASE
      WHEN agg.total_sent > 0 THEN ROUND((agg.bounced_count::NUMERIC / agg.total_sent::NUMERIC) * 100, 2)
      ELSE 0
    END as bounce_rate,
    agg.opened_count,
    CASE
      WHEN agg.total_sent > 0 THEN ROUND((agg.opened_count::NUMERIC / agg.total_sent::NUMERIC) * 100, 2)
      ELSE 0
    END as open_rate,
    agg.clicked_count,
    CASE
      WHEN agg.total_sent > 0 THEN ROUND((agg.clicked_count::NUMERIC / agg.total_sent::NUMERIC) * 100, 2)
      ELSE 0
    END as click_rate,
    CASE
      WHEN agg.opened_count > 0 THEN ROUND((agg.clicked_count::NUMERIC / agg.opened_count::NUMERIC) * 100, 2)
      ELSE 0
    END as click_to_open_rate,
    agg.complained_count
  FROM aggregated agg;
END;
$$;

COMMENT ON FUNCTION public.get_email_metrics_for_person IS
'Returns email metrics for a specific person including delivery, open, click, and bounce rates';

-- =========================
-- Function: get_email_campaign_metrics
-- =========================
-- Returns metrics for a specific campaign (identified by tag)
CREATE OR REPLACE FUNCTION public.get_email_campaign_metrics(p_campaign_name TEXT)
RETURNS TABLE (
  campaign_name TEXT,
  total_sent BIGINT,
  delivered_count BIGINT,
  opened_count BIGINT,
  clicked_count BIGINT,
  bounced_count BIGINT,
  open_rate NUMERIC,
  click_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH campaign_emails AS (
    SELECT em.id
    FROM email_message em
    WHERE EXISTS (
      SELECT 1
      FROM jsonb_array_elements(em.tags) as tag
      WHERE tag->>'name' = 'campaign' AND tag->>'value' = p_campaign_name
    )
  ),
  email_stats AS (
    SELECT
      ce.id,
      EXISTS(
        SELECT 1 FROM email_event ee
        WHERE ee.email_message_id = ce.id AND ee.event_type = 'delivered'
      ) as is_delivered,
      EXISTS(
        SELECT 1 FROM email_event ee
        WHERE ee.email_message_id = ce.id AND ee.event_type = 'opened'
      ) as is_opened,
      EXISTS(
        SELECT 1 FROM email_event ee
        WHERE ee.email_message_id = ce.id AND ee.event_type = 'clicked'
      ) as is_clicked,
      EXISTS(
        SELECT 1 FROM email_event ee
        WHERE ee.email_message_id = ce.id AND ee.event_type = 'bounced'
      ) as is_bounced
    FROM campaign_emails ce
  ),
  aggregated AS (
    SELECT
      COUNT(*)::BIGINT as total_sent,
      COUNT(*) FILTER (WHERE is_delivered)::BIGINT as delivered_count,
      COUNT(*) FILTER (WHERE is_opened)::BIGINT as opened_count,
      COUNT(*) FILTER (WHERE is_clicked)::BIGINT as clicked_count,
      COUNT(*) FILTER (WHERE is_bounced)::BIGINT as bounced_count
    FROM email_stats
  )
  SELECT
    p_campaign_name as campaign_name,
    agg.total_sent,
    agg.delivered_count,
    agg.opened_count,
    agg.clicked_count,
    agg.bounced_count,
    CASE
      WHEN agg.total_sent > 0 THEN ROUND((agg.opened_count::NUMERIC / agg.total_sent::NUMERIC) * 100, 2)
      ELSE 0
    END as open_rate,
    CASE
      WHEN agg.total_sent > 0 THEN ROUND((agg.clicked_count::NUMERIC / agg.total_sent::NUMERIC) * 100, 2)
      ELSE 0
    END as click_rate
  FROM aggregated agg;
END;
$$;

COMMENT ON FUNCTION public.get_email_campaign_metrics IS
'Returns email metrics for a specific campaign identified by tag';

-- =========================
-- Function: get_top_clicked_links
-- =========================
-- Returns most clicked links across all emails
CREATE OR REPLACE FUNCTION public.get_top_clicked_links(p_limit INT DEFAULT 10)
RETURNS TABLE (
  link_url TEXT,
  click_count BIGINT,
  unique_email_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ee.link_url,
    COUNT(*)::BIGINT as click_count,
    COUNT(DISTINCT ee.email_message_id)::BIGINT as unique_email_count
  FROM email_event ee
  WHERE ee.event_type = 'clicked' AND ee.link_url IS NOT NULL
  GROUP BY ee.link_url
  ORDER BY click_count DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.get_top_clicked_links IS
'Returns most clicked links with total clicks and unique emails';

-- =========================
-- Function: get_recent_email_events
-- =========================
-- Returns recent email events within specified hours
CREATE OR REPLACE FUNCTION public.get_recent_email_events(p_hours INT DEFAULT 24)
RETURNS TABLE (
  event_id UUID,
  email_message_id UUID,
  event_type TEXT,
  link_url TEXT,
  occurred_at TIMESTAMPTZ,
  person_id UUID,
  subject TEXT,
  to_address TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ee.id as event_id,
    ee.email_message_id,
    ee.event_type,
    ee.link_url,
    ee.occurred_at,
    em.person_id,
    em.subject,
    em.to_address
  FROM email_event ee
  JOIN email_message em ON ee.email_message_id = em.id
  WHERE ee.occurred_at > NOW() - (p_hours || ' hours')::INTERVAL
  ORDER BY ee.occurred_at DESC;
END;
$$;

COMMENT ON FUNCTION public.get_recent_email_events IS
'Returns recent email events within specified hours with email message details';

-- =========================
-- Function: get_email_timing_metrics
-- =========================
-- Calculates timing metrics for email engagement
CREATE OR REPLACE FUNCTION public.get_email_timing_metrics(p_person_id UUID)
RETURNS TABLE (
  avg_time_to_open_minutes NUMERIC,
  avg_time_to_click_minutes NUMERIC,
  median_time_to_open_minutes NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH open_times AS (
    SELECT
      EXTRACT(EPOCH FROM (ee_open.occurred_at - em.sent_at)) / 60 as minutes_to_open
    FROM email_message em
    JOIN email_event ee_open ON em.id = ee_open.email_message_id
    WHERE em.person_id = p_person_id
      AND ee_open.event_type = 'opened'
  ),
  click_times AS (
    SELECT
      EXTRACT(EPOCH FROM (ee_click.occurred_at - em.sent_at)) / 60 as minutes_to_click
    FROM email_message em
    JOIN email_event ee_click ON em.id = ee_click.email_message_id
    WHERE em.person_id = p_person_id
      AND ee_click.event_type = 'clicked'
  )
  SELECT
    COALESCE(ROUND(AVG(ot.minutes_to_open)::NUMERIC, 2), 0) as avg_time_to_open_minutes,
    COALESCE(ROUND(AVG(ct.minutes_to_click)::NUMERIC, 2), 0) as avg_time_to_click_minutes,
    COALESCE(ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ot.minutes_to_open))::NUMERIC, 2), 0) as median_time_to_open_minutes
  FROM open_times ot
  FULL OUTER JOIN click_times ct ON true;
END;
$$;

COMMENT ON FUNCTION public.get_email_timing_metrics IS
'Returns timing metrics for email engagement including average time to open and click';

-- =========================
-- Function: get_active_email_users
-- =========================
-- Identifies active email recipients based on opens
CREATE OR REPLACE FUNCTION public.get_active_email_users(
  p_days INT DEFAULT 7,
  p_min_opens INT DEFAULT 1
)
RETURNS TABLE (
  person_id UUID,
  email TEXT,
  total_sent BIGINT,
  total_opens BIGINT,
  total_clicks BIGINT,
  last_opened_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as person_id,
    p.email,
    COUNT(DISTINCT em.id)::BIGINT as total_sent,
    COUNT(DISTINCT CASE WHEN ee.event_type = 'opened' THEN ee.id END)::BIGINT as total_opens,
    COUNT(DISTINCT CASE WHEN ee.event_type = 'clicked' THEN ee.id END)::BIGINT as total_clicks,
    MAX(CASE WHEN ee.event_type = 'opened' THEN ee.occurred_at END) as last_opened_at
  FROM person p
  JOIN email_message em ON p.id = em.person_id
  LEFT JOIN email_event ee ON em.id = ee.email_message_id
  WHERE em.sent_at > NOW() - (p_days || ' days')::INTERVAL
  GROUP BY p.id, p.email
  HAVING COUNT(DISTINCT CASE WHEN ee.event_type = 'opened' THEN ee.id END) >= p_min_opens
  ORDER BY total_opens DESC, total_clicks DESC;
END;
$$;

COMMENT ON FUNCTION public.get_active_email_users IS
'Returns active email recipients based on minimum opens within specified days';

-- =========================
-- Function: get_person_email_timeline
-- =========================
-- Returns chronological email event timeline for a person
CREATE OR REPLACE FUNCTION public.get_person_email_timeline(p_person_id UUID)
RETURNS TABLE (
  event_id UUID,
  email_message_id UUID,
  subject TEXT,
  event_type TEXT,
  link_url TEXT,
  occurred_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ee.id as event_id,
    ee.email_message_id,
    em.subject,
    ee.event_type,
    ee.link_url,
    ee.occurred_at
  FROM email_event ee
  JOIN email_message em ON ee.email_message_id = em.id
  WHERE em.person_id = p_person_id
  ORDER BY ee.occurred_at DESC;
END;
$$;

COMMENT ON FUNCTION public.get_person_email_timeline IS
'Returns chronological email event timeline for a specific person';

-- =========================
-- Grant execute permissions
-- =========================
GRANT EXECUTE ON FUNCTION public.get_email_metrics_for_person TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_email_campaign_metrics TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_top_clicked_links TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_recent_email_events TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_email_timing_metrics TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_active_email_users TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_person_email_timeline TO anon, authenticated, service_role;

-- =========================
-- Success Message
-- =========================
DO $$
BEGIN
  RAISE NOTICE 'GDP-005: Email Event Tracking Analytics functions created successfully!';
  RAISE NOTICE 'Functions: get_email_metrics_for_person, get_email_campaign_metrics, get_top_clicked_links';
  RAISE NOTICE 'Functions: get_recent_email_events, get_email_timing_metrics, get_active_email_users';
  RAISE NOTICE 'Function: get_person_email_timeline';
END $$;
