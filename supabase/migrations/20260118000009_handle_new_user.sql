-- =========================
-- DB-009: Handle New User Trigger
-- =========================
-- Creates trigger to automatically:
-- 1. Create a profile for new users
-- 2. Grant 10 trial credits on signup
--
-- This migration ensures the handle_new_user function and trigger exist.
-- The function may already exist from the profiles migration, so we use
-- CREATE OR REPLACE to make this idempotent.

-- =========================
-- Create or replace handle_new_user function
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile for the new user
  -- Uses COALESCE to try multiple metadata fields for display name
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

  -- Grant 10 trial credits (1 free video)
  -- ON CONFLICT DO NOTHING ensures idempotency
  INSERT INTO public.credit_ledger (user_id, type, amount, note)
  VALUES (NEW.id, 'purchase', 10, 'Welcome bonus: 10 trial credits')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- =========================
-- Create trigger on auth.users
-- =========================
-- Drop existing trigger if it exists to ensure clean state
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger that fires AFTER INSERT on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- Add comments for documentation
-- =========================
COMMENT ON FUNCTION public.handle_new_user() IS 'Trigger function that creates profile and grants trial credits on user signup';
