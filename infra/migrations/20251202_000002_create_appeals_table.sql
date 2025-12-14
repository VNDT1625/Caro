-- Migration: Create Appeals Table
-- Description: Tạo bảng appeals cho hệ thống khiếu nại
-- Date: 2024-12-02

-- Create enum for appeal status
DO $$ BEGIN
  CREATE TYPE public.appeal_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create appeals table
CREATE TABLE IF NOT EXISTS public.appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  
  -- Appeal details
  reason text NOT NULL,
  status public.appeal_status NOT NULL DEFAULT 'pending',
  
  -- Admin response
  admin_response text,
  processed_by uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  processed_at timestamptz,
  
  -- Audit timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT check_reason_not_empty CHECK (length(trim(reason)) > 0),
  CONSTRAINT check_reason_length CHECK (length(reason) <= 2000),
  CONSTRAINT check_admin_response_length CHECK (length(admin_response) <= 2000),
  CONSTRAINT check_one_appeal_per_report UNIQUE (report_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_appeals_report ON public.appeals(report_id);
CREATE INDEX IF NOT EXISTS idx_appeals_user ON public.appeals(user_id);
CREATE INDEX IF NOT EXISTS idx_appeals_status ON public.appeals(status);
CREATE INDEX IF NOT EXISTS idx_appeals_created ON public.appeals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appeals_processed ON public.appeals(processed_at DESC) WHERE processed_at IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- 1) Users can create appeals for their own bans
DROP POLICY IF EXISTS appeals_insert_own ON public.appeals;
CREATE POLICY appeals_insert_own ON public.appeals
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- 2) Users can view their own appeals
DROP POLICY IF EXISTS appeals_select_own ON public.appeals;
CREATE POLICY appeals_select_own ON public.appeals
  FOR SELECT 
  USING (auth.uid() = user_id);

-- 3) Admins can view all appeals
DROP POLICY IF EXISTS appeals_select_admin ON public.appeals;
CREATE POLICY appeals_select_admin ON public.appeals
  FOR SELECT 
  USING (public.is_admin(auth.uid()));

-- 4) Admins can update appeals
DROP POLICY IF EXISTS appeals_update_admin ON public.appeals;
CREATE POLICY appeals_update_admin ON public.appeals
  FOR UPDATE 
  USING (public.is_admin(auth.uid()));

-- 5) Admins can delete appeals
DROP POLICY IF EXISTS appeals_delete_admin ON public.appeals;
CREATE POLICY appeals_delete_admin ON public.appeals
  FOR DELETE 
  USING (public.is_admin(auth.uid()));

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_appeals_updated_at()
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
DROP TRIGGER IF EXISTS trigger_appeals_updated_at ON public.appeals;
CREATE TRIGGER trigger_appeals_updated_at
  BEFORE UPDATE ON public.appeals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_appeals_updated_at();

-- Comments for documentation
COMMENT ON TABLE public.appeals IS 'Khiếu nại từ người chơi bị xử phạt';
COMMENT ON COLUMN public.appeals.status IS 'Trạng thái: pending | approved | rejected';
COMMENT ON COLUMN public.appeals.reason IS 'Lý do khiếu nại từ người chơi';
COMMENT ON COLUMN public.appeals.admin_response IS 'Phản hồi từ admin';

-- Grant permissions
GRANT SELECT, INSERT ON public.appeals TO authenticated;
GRANT ALL ON public.appeals TO service_role;
