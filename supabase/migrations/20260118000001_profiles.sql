-- =========================
-- DB-001: Profiles Table Migration
-- =========================
-- Creates profiles table linked to auth.users with RLS policies
-- Auto-creates profile on user signup with trial credits

-- Create profiles table if not exists (idempotent)
-- Note: If table already exists from earlier migration, just add missing columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    CREATE TABLE public.profiles (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      display_name TEXT,
      email TEXT,
      avatar_url TEXT,
      notification_prefs JSONB DEFAULT '{"job_complete": true, "job_failed": true}'::jsonb,
      stripe_customer_id TEXT UNIQUE,
      subscription_tier TEXT DEFAULT 'free',
      subscription_status TEXT DEFAULT 'inactive',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  END IF;
END $$;

-- Add missing columns if they don't exist (for backwards compatibility)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{"job_complete": true, "job_failed": true}'::jsonb;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_stripe ON public.profiles(stripe_customer_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- RLS Policies
-- =========================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- Users can update their own profile
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Service role can do everything (for API and worker)
DROP POLICY IF EXISTS "profiles_service_role" ON public.profiles;
CREATE POLICY "profiles_service_role"
ON public.profiles FOR ALL
USING (auth.role() = 'service_role');

-- =========================
-- Auto-create profile on user signup
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    updated_at = NOW();

  -- Grant trial credits (10 credits = 1 free video)
  INSERT INTO public.credit_ledger (user_id, type, amount, note)
  VALUES (NEW.id, 'purchase', 10, 'Welcome bonus: 10 trial credits')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add comments (only if column exists)
DO $$
BEGIN
  COMMENT ON TABLE public.profiles IS 'User profiles with Stripe integration and preferences';
  COMMENT ON COLUMN public.profiles.stripe_customer_id IS 'Stripe customer ID for billing';

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'notification_prefs'
  ) THEN
    COMMENT ON COLUMN public.profiles.notification_prefs IS 'User notification preferences';
  END IF;
END $$;
