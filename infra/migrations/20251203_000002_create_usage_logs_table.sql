-- Migration: Create Usage Logs Table
-- Description: Tạo bảng usage_logs để theo dõi sử dụng tính năng AI
-- Date: 2024-12-03

-- Create enum for feature types
DO $ BEGIN
  CREATE TYPE public.analysis_feature AS ENUM ('basic_analysis', 'pro_analysis', 'replay', 'ai_qa');
EXCEPTION WHEN duplicate_object THEN NULL; END $;

-- Create usage_logs table
CREATE TABLE IF NOT EXISTS public.usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User reference
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  
  -- Usage details
  feature public.analysis_feature NOT NULL,
  count integer DEFAULT 1,
  
  -- Time tracking
  date date NOT NULL DEFAULT CURRENT_DATE,
  period varchar(7) NOT NULL DEFAULT to_char(CURRENT_DATE, 'YYYY-MM'),
  
  -- Audit timestamp
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_date ON public.usage_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_period ON public.usage_logs(user_id, period);
CREATE INDEX IF NOT EXISTS idx_usage_logs_feature ON public.usage_logs(feature);
CREATE INDEX IF NOT EXISTS idx_usage_logs_date ON public.usage_logs(date DESC);

-- Enable Row Level Security
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- 1) Users can view their own usage logs
DROP POLICY IF EXISTS usage_logs_select_own ON public.usage_logs;
CREATE POLICY usage_logs_select_own ON public.usage_logs
  FOR SELECT 
  USING (auth.uid() = user_id);

-- 2) Users can insert their own usage logs
DROP POLICY IF EXISTS usage_logs_insert_own ON public.usage_logs;
CREATE POLICY usage_logs_insert_own ON public.usage_logs
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- 3) Admins can view all usage logs
DROP POLICY IF EXISTS usage_logs_select_admin ON public.usage_logs;
CREATE POLICY usage_logs_select_admin ON public.usage_logs
  FOR SELECT 
  USING (public.is_admin(auth.uid()));

-- Function to get daily usage count for a user and feature
CREATE OR REPLACE FUNCTION public.get_daily_usage(
  p_user_id uuid,
  p_feature public.analysis_feature
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
  v_count integer;
BEGIN
  SELECT COALESCE(SUM(count), 0) INTO v_count
  FROM public.usage_logs
  WHERE user_id = p_user_id
    AND feature = p_feature
    AND date = CURRENT_DATE;
  
  RETURN v_count;
END;
$;

-- Function to get monthly usage count for a user and feature
CREATE OR REPLACE FUNCTION public.get_monthly_usage(
  p_user_id uuid,
  p_feature public.analysis_feature
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
  v_count integer;
BEGIN
  SELECT COALESCE(SUM(count), 0) INTO v_count
  FROM public.usage_logs
  WHERE user_id = p_user_id
    AND feature = p_feature
    AND period = to_char(CURRENT_DATE, 'YYYY-MM');
  
  RETURN v_count;
END;
$;

-- Function to log usage
CREATE OR REPLACE FUNCTION public.log_usage(
  p_user_id uuid,
  p_feature public.analysis_feature,
  p_count integer DEFAULT 1
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.usage_logs (user_id, feature, count, date, period)
  VALUES (p_user_id, p_feature, p_count, CURRENT_DATE, to_char(CURRENT_DATE, 'YYYY-MM'))
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$;

-- Comments for documentation
COMMENT ON TABLE public.usage_logs IS 'Theo dõi sử dụng tính năng AI analysis';
COMMENT ON COLUMN public.usage_logs.feature IS 'Loại tính năng: basic_analysis | pro_analysis | replay | ai_qa';
COMMENT ON COLUMN public.usage_logs.date IS 'Ngày sử dụng (để tính daily limit)';
COMMENT ON COLUMN public.usage_logs.period IS 'Tháng sử dụng YYYY-MM (để tính monthly limit)';
COMMENT ON FUNCTION public.get_daily_usage IS 'Lấy số lần sử dụng trong ngày';
COMMENT ON FUNCTION public.get_monthly_usage IS 'Lấy số lần sử dụng trong tháng';
COMMENT ON FUNCTION public.log_usage IS 'Ghi log sử dụng tính năng';

-- Grant permissions
GRANT SELECT, INSERT ON public.usage_logs TO authenticated;
GRANT ALL ON public.usage_logs TO service_role;
GRANT EXECUTE ON FUNCTION public.get_daily_usage TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_monthly_usage TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_usage TO authenticated;
