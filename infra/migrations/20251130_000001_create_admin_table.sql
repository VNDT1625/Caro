-- Create enum for admin roles
DO $$ BEGIN
  CREATE TYPE public.admin_role AS ENUM ('super', 'manager_users', 'manager_finance', 'readonly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create admin table (singular name as requested)
CREATE TABLE IF NOT EXISTS public.admin (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  role public.admin_role NOT NULL DEFAULT 'readonly',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz
);

ALTER TABLE public.admin ENABLE ROW LEVEL SECURITY;

-- Helper function: check if a uid is admin (active)
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin a
    WHERE a.user_id = uid AND a.is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon, authenticated;

-- Policies
-- 1) Allow a user to see their own admin row if it exists
DROP POLICY IF EXISTS admin_self_read ON public.admin;
CREATE POLICY admin_self_read ON public.admin
FOR SELECT USING (user_id = auth.uid());

-- 2) Allow any admin to read all admin rows (for Admin UI listing)
DROP POLICY IF EXISTS admin_all_read ON public.admin;
CREATE POLICY admin_all_read ON public.admin
FOR SELECT USING (public.is_admin(auth.uid()));

-- No INSERT/UPDATE/DELETE policies: only service role (bypasses RLS) or direct SQL can modify admins
-- You can manage this table via Supabase SQL editor or secure backend using service key.

-- Indexes
CREATE INDEX IF NOT EXISTS admin_email_idx ON public.admin (email);
