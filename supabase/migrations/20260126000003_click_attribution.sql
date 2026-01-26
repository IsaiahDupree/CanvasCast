-- =========================
-- GDP-006: Click Redirect Tracker
-- =========================
-- Creates click_attribution table to track email link clicks
-- and build attribution spine: email → click → session → conversion

-- =========================
-- Table: click_attribution
-- =========================
-- Tracks link clicks from emails with unique tokens for attribution
CREATE TABLE IF NOT EXISTS public.click_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_message_id UUID REFERENCES public.email_message(id) ON DELETE CASCADE,
  click_token TEXT NOT NULL UNIQUE,
  link_url TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_click_attribution_token ON public.click_attribution(click_token);
CREATE INDEX IF NOT EXISTS idx_click_attribution_email ON public.click_attribution(email_message_id);
CREATE INDEX IF NOT EXISTS idx_click_attribution_clicked_at ON public.click_attribution(clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_click_attribution_link_url ON public.click_attribution(link_url);

-- RLS Policies
ALTER TABLE public.click_attribution ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "click_attribution_service_role" ON public.click_attribution;
CREATE POLICY "click_attribution_service_role"
ON public.click_attribution FOR ALL
USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE public.click_attribution IS 'Tracks email link clicks for attribution';
COMMENT ON COLUMN public.click_attribution.click_token IS 'Unique token for tracking click through session';
COMMENT ON COLUMN public.click_attribution.link_url IS 'Original link URL from email';
COMMENT ON COLUMN public.click_attribution.user_agent IS 'User agent of the click';
COMMENT ON COLUMN public.click_attribution.ip_address IS 'IP address of the click';
COMMENT ON COLUMN public.click_attribution.clicked_at IS 'When the click occurred';

-- =========================
-- Function: generate_tracking_url
-- =========================
-- Helper function to generate tracking URLs for emails
CREATE OR REPLACE FUNCTION public.generate_tracking_url(
  p_email_message_id UUID,
  p_target_url TEXT,
  p_base_url TEXT DEFAULT 'https://canvascast.com'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_encoded_target TEXT;
BEGIN
  -- URL encode the target
  v_encoded_target := urlencode(p_target_url);

  -- Return tracking URL
  RETURN p_base_url || '/click?email_id=' || p_email_message_id::text || '&target=' || v_encoded_target;
END;
$$;

COMMENT ON FUNCTION public.generate_tracking_url IS
'Generates tracking URL for email links with email_message_id and target parameters';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.generate_tracking_url TO anon, authenticated, service_role;

-- =========================
-- Function: urlencode (helper)
-- =========================
-- Simple URL encoding function
CREATE OR REPLACE FUNCTION public.urlencode(input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  output TEXT := '';
  ch TEXT;
BEGIN
  FOR i IN 1..length(input) LOOP
    ch := substring(input FROM i FOR 1);
    IF ch ~ '[A-Za-z0-9\-_.~]' THEN
      output := output || ch;
    ELSE
      output := output || '%' || to_hex(ascii(ch));
    END IF;
  END LOOP;
  RETURN output;
END;
$$;

COMMENT ON FUNCTION public.urlencode IS 'URL encodes a string';

-- =========================
-- Function: get_click_attribution_by_token
-- =========================
-- Retrieves click attribution data by token for session linking
CREATE OR REPLACE FUNCTION public.get_click_attribution_by_token(p_click_token TEXT)
RETURNS TABLE (
  id UUID,
  email_message_id UUID,
  click_token TEXT,
  link_url TEXT,
  person_id UUID,
  clicked_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ca.id,
    ca.email_message_id,
    ca.click_token,
    ca.link_url,
    em.person_id,
    ca.clicked_at
  FROM click_attribution ca
  JOIN email_message em ON ca.email_message_id = em.id
  WHERE ca.click_token = p_click_token;
END;
$$;

COMMENT ON FUNCTION public.get_click_attribution_by_token IS
'Retrieves click attribution data by token for linking to session and conversion';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_click_attribution_by_token TO anon, authenticated, service_role;

-- =========================
-- Success Message
-- =========================
DO $$
BEGIN
  RAISE NOTICE 'GDP-006: Click Redirect Tracker schema created successfully!';
  RAISE NOTICE 'Table: click_attribution with click_token tracking';
  RAISE NOTICE 'Functions: generate_tracking_url, get_click_attribution_by_token';
END $$;
