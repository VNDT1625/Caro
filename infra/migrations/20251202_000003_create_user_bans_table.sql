-- Migration: Create User Bans Table
-- Description: Tạo bảng user_bans cho hệ thống xử phạt
-- Date: 2024-12-02

-- Create enum for ban types
DO $$ BEGIN
  CREATE TYPE public.ban_type AS ENUM ('temporary', 'permanent', 'warning');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create user_bans table
CREATE TABLE IF NOT EXISTS public.user_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User and report references
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  
  -- Ban details
  ban_type public.ban_type NOT NULL,
  reason text NOT NULL,
  
  -- Ban duration (for temporary bans)
  expires_at timestamptz,
  
  -- Ban status
  is_active boolean NOT NULL DEFAULT true,
  lifted_at timestamptz,
  lifted_by uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  lift_reason text,
  
  -- Audit timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT check_reason_not_empty CHECK (length(trim(reason)) > 0),
  CONSTRAINT check_reason_length CHECK (length(reason) <= 2000),
  CONSTRAINT check_lift_reason_length CHECK (length(lift_reason) <= 2000),
  CONSTRAINT check_temporary_has_expiry CHECK (
    ban_type != 'temporary' OR expires_at IS NOT NULL
  ),
  CONSTRAINT check_permanent_no_expiry CHECK (
    ban_type != 'permanent' OR expires_at IS NULL
  ),
  CONSTRAINT check_lifted_has_reason CHECK (
    lifted_at IS NULL OR lift_reason IS NOT NULL
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_bans_user ON public.user_bans(user_id);
CREATE INDEX IF NOT EXISTS idx_user_bans_report ON public.user_bans(report_id);
CREATE INDEX IF NOT EXISTS idx_user_bans_active ON public.user_bans(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_bans_expires ON public.user_bans(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_bans_created ON public.user_bans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_bans_type ON public.user_bans(ban_type);

-- Enable Row Level Security
ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- 1) Users can view their own bans
DROP POLICY IF EXISTS user_bans_select_own ON public.user_bans;
CREATE POLICY user_bans_select_own ON public.user_bans
  FOR SELECT 
  USING (auth.uid() = user_id);

-- 2) Admins can view all bans
DROP POLICY IF EXISTS user_bans_select_admin ON public.user_bans;
CREATE POLICY user_bans_select_admin ON public.user_bans
  FOR SELECT 
  USING (public.is_admin(auth.uid()));

-- 3) Admins can insert bans
DROP POLICY IF EXISTS user_bans_insert_admin ON public.user_bans;
CREATE POLICY user_bans_insert_admin ON public.user_bans
  FOR INSERT 
  WITH CHECK (public.is_admin(auth.uid()));

-- 4) Admins can update bans
DROP POLICY IF EXISTS user_bans_update_admin ON public.user_bans;
CREATE POLICY user_bans_update_admin ON public.user_bans
  FOR UPDATE 
  USING (public.is_admin(auth.uid()));

-- 5) Admins can delete bans
DROP POLICY IF EXISTS user_bans_delete_admin ON public.user_bans;
CREATE POLICY user_bans_delete_admin ON public.user_bans
  FOR DELETE 
  USING (public.is_admin(auth.uid()));

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_user_bans_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_user_bans_updated_at ON public.user_bans;
CREATE TRIGGER trigger_user_bans_updated_at
  BEFORE UPDATE ON public.user_bans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_bans_updated_at();

-- Create function to check if user is banned
CREATE OR REPLACE FUNCTION public.is_user_banned(check_user_id uuid)
RETURNS TABLE(
  is_banned boolean,
  ban_type text,
  reason text,
  expires_at timestamptz,
  report_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check for permanent ban first
  RETURN QUERY
  SELECT 
    true,
    ub.ban_type::text,
    ub.reason,
    ub.expires_at,
    ub.report_id
  FROM public.user_bans ub
  WHERE ub.user_id = check_user_id 
    AND ub.is_active = true 
    AND ub.ban_type = 'permanent'
  LIMIT 1;
  
  IF FOUND THEN
    RETURN;
  END IF;
  
  -- Check for active temporary ban
  RETURN QUERY
  SELECT 
    true,
    ub.ban_type::text,
    ub.reason,
    ub.expires_at,
    ub.report_id
  FROM public.user_bans ub
  WHERE ub.user_id = check_user_id 
    AND ub.is_active = true 
    AND ub.ban_type = 'temporary'
    AND (ub.expires_at IS NULL OR ub.expires_at > now())
  ORDER BY ub.created_at DESC
  LIMIT 1;
  
  IF FOUND THEN
    RETURN;
  END IF;
  
  -- No active ban
  RETURN QUERY
  SELECT false, null::text, null::text, null::timestamptz, null::uuid;
END;
$$;

-- Grant execute permission on function
GRANT EXECUTE ON FUNCTION public.is_user_banned(uuid) TO authenticated, anon;

-- Comments for documentation
COMMENT ON TABLE public.user_bans IS 'Lịch sử xử phạt người chơi';
COMMENT ON COLUMN public.user_bans.ban_type IS 'Loại phạt: temporary | permanent | warning';
COMMENT ON COLUMN public.user_bans.is_active IS 'Ban còn hiệu lực hay đã được gỡ';
COMMENT ON COLUMN public.user_bans.expires_at IS 'Thời điểm hết hạn (chỉ cho temporary ban)';
COMMENT ON FUNCTION public.is_user_banned(uuid) IS 'Kiểm tra xem user có đang bị ban không';

-- Grant permissions
GRANT SELECT ON public.user_bans TO authenticated;
GRANT ALL ON public.user_bans TO service_role;
