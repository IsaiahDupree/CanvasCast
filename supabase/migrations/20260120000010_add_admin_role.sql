-- =========================
-- Add Admin Role to Profiles
-- =========================
-- Adds is_admin column to profiles table for admin dashboard access

-- Add is_admin column if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create index for admin queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin) WHERE is_admin = true;

-- RLS Policy: Allow admins to read all profiles
DROP POLICY IF EXISTS "profiles_admin_select_all" ON public.profiles;
CREATE POLICY "profiles_admin_select_all"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- Add comment
COMMENT ON COLUMN public.profiles.is_admin IS 'Admin role flag for dashboard access';

-- Note: To make a user an admin, run:
-- UPDATE public.profiles SET is_admin = true WHERE email = 'admin@example.com';
