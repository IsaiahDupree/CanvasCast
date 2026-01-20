-- =========================
-- Add account_status field to profiles
-- =========================
-- For ADMIN-003: User Management feature

-- Add account_status column with default 'active'
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'deleted'));

-- Add is_admin column with default false
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Add index for account_status for filtering
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status);

-- Add index for is_admin for admin checks
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin);

-- Add comments
COMMENT ON COLUMN public.profiles.account_status IS 'Account status: active, suspended, or deleted';
COMMENT ON COLUMN public.profiles.is_admin IS 'Whether user has admin privileges';
