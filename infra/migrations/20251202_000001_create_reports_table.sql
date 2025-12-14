-- Migration: Create Reports Table
-- Description: Tạo bảng reports cho hệ thống báo cáo vi phạm và gian lận
-- Date: 2024-12-02

-- Create enum for report types
DO $$ BEGIN
  CREATE TYPE public.report_type AS ENUM ('gian_lan_trong_tran', 'toxic', 'bug', 'khac');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create enum for report status
DO $$ BEGIN
  CREATE TYPE public.report_status AS ENUM ('pending', 'auto_flagged', 'resolved', 'dismissed', 'escalated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create reports table
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reporter and reported user
  reporter_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  
  -- Match reference (for cheating reports)
  match_id uuid REFERENCES matches(id) ON DELETE SET NULL,
  
  -- Report details
  type public.report_type NOT NULL,
  description text,
  status public.report_status NOT NULL DEFAULT 'pending',
  
  -- Rule-based analysis results
  rule_analysis jsonb,
  reason_result text,
  
  -- AI analysis results
  ai_analysis jsonb,
  ai_summary_player text,
  ai_details_admin text,
  
  -- Processing metadata
  processed_at timestamptz,
  processed_by uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  admin_notes text,
  
  -- Audit timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT check_description_length CHECK (length(description) <= 1000),
  CONSTRAINT check_admin_notes_length CHECK (length(admin_notes) <= 2000)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_type ON public.reports(type);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported ON public.reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_match ON public.reports(match_id);
CREATE INDEX IF NOT EXISTS idx_reports_created ON public.reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_processed ON public.reports(processed_at DESC) WHERE processed_at IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- 1) Users can create reports (insert their own reports)
DROP POLICY IF EXISTS reports_insert_own ON public.reports;
CREATE POLICY reports_insert_own ON public.reports
  FOR INSERT 
  WITH CHECK (auth.uid() = reporter_id);

-- 2) Users can view their own reports (as reporter or reported user)
DROP POLICY IF EXISTS reports_select_own ON public.reports;
CREATE POLICY reports_select_own ON public.reports
  FOR SELECT 
  USING (
    auth.uid() = reporter_id OR 
    auth.uid() = reported_user_id
  );

-- 3) Admins can view all reports
DROP POLICY IF EXISTS reports_select_admin ON public.reports;
CREATE POLICY reports_select_admin ON public.reports
  FOR SELECT 
  USING (public.is_admin(auth.uid()));

-- 4) Admins can update reports
DROP POLICY IF EXISTS reports_update_admin ON public.reports;
CREATE POLICY reports_update_admin ON public.reports
  FOR UPDATE 
  USING (public.is_admin(auth.uid()));

-- 5) Admins can delete reports (soft delete via status change preferred)
DROP POLICY IF EXISTS reports_delete_admin ON public.reports;
CREATE POLICY reports_delete_admin ON public.reports
  FOR DELETE 
  USING (public.is_admin(auth.uid()));

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_reports_updated_at()
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
DROP TRIGGER IF EXISTS trigger_reports_updated_at ON public.reports;
CREATE TRIGGER trigger_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_reports_updated_at();

-- Comments for documentation
COMMENT ON TABLE public.reports IS 'Báo cáo vi phạm từ người chơi';
COMMENT ON COLUMN public.reports.type IS 'Loại vi phạm: gian_lan_trong_tran | toxic | bug | khac';
COMMENT ON COLUMN public.reports.status IS 'Trạng thái: pending | auto_flagged | resolved | dismissed | escalated';
COMMENT ON COLUMN public.reports.rule_analysis IS 'Kết quả phân tích rule-based (JSON)';
COMMENT ON COLUMN public.reports.ai_analysis IS 'Kết quả phân tích AI (JSON)';
COMMENT ON COLUMN public.reports.ai_summary_player IS 'Tóm tắt cho người chơi';
COMMENT ON COLUMN public.reports.ai_details_admin IS 'Chi tiết cho admin';

-- Grant permissions
GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
