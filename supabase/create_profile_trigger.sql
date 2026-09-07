-- ============================================================
-- Supabase Trigger: Auto-create a public.profiles row
-- whenever a new user signs up via auth.users.
--
-- HOW TO RUN:
--   1. Go to your Supabase Dashboard → SQL Editor
--   2. Paste this entire script and click "Run"
-- ============================================================

-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER          -- Runs with the owner's permissions (bypasses RLS)
SET search_path = public  -- Prevent search_path hijacking
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, total_points)
  VALUES (
    NEW.id,                                          -- Maps auth.users.id → profiles.id
    NEW.email,                                       -- Copies the email
    COALESCE(NEW.raw_user_meta_data->>'name', ''),   -- Optional: grab name from signup metadata
    'student',                                       -- Default role for new signups
    0                                                -- Start with 0 points
  );
  RETURN NEW;
END;
$$;

-- 2. Create the trigger on auth.users
--    DROP first to make this script idempotent (safe to re-run)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
