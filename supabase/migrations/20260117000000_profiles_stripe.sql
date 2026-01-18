-- =========================
-- Profiles Table with Stripe Integration
-- =========================
-- This migration adds a profiles table to store user profile data
-- and Stripe customer ID for payment processing

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  stripe_customer_id TEXT UNIQUE,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'business', 'enterprise')),
  subscription_status TEXT DEFAULT 'inactive' CHECK (subscription_status IN ('inactive', 'active', 'canceled', 'past_due')),
  subscription_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON public.profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription ON public.profiles(subscription_tier, subscription_status);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Service role can do everything
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
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();
  
  -- Also create notification preferences
  INSERT INTO public.user_notification_prefs (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Give new users 10 free credits
  INSERT INTO public.credit_ledger (user_id, type, amount, note)
  VALUES (NEW.id, 'purchase', 10, 'Welcome bonus - 10 free credits');
  
  RETURN NEW;
END;
$$;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- Credit Pricing Plans
-- =========================
CREATE TABLE IF NOT EXISTS public.credit_packages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  credits INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  stripe_price_id TEXT,
  popular BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default credit packages
INSERT INTO public.credit_packages (id, name, credits, price_cents, popular) VALUES
  ('starter', 'Starter Pack', 10, 999, FALSE),
  ('popular', 'Popular Pack', 50, 3999, TRUE),
  ('pro', 'Pro Pack', 150, 9999, FALSE),
  ('business', 'Business Pack', 500, 24999, FALSE)
ON CONFLICT (id) DO UPDATE SET
  credits = EXCLUDED.credits,
  price_cents = EXCLUDED.price_cents;

-- =========================
-- Voice samples storage bucket
-- =========================
-- Note: Create 'voice-samples' bucket in Supabase Storage dashboard
-- with the following settings:
-- - Private bucket
-- - Max file size: 50MB
-- - Allowed MIME types: audio/*

-- Storage policies for voice samples
-- (These need to be run after bucket creation)
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('voice-samples', 'voice-samples', false)
-- ON CONFLICT (id) DO NOTHING;
