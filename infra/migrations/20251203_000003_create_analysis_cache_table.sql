-- Migration: Create Analysis Cache Table
-- Description: Tạo bảng analysis_cache để cache kết quả phân tích AI
-- Date: 2024-12-03

-- Create analysis_cache table
CREATE TABLE IF NOT EXISTS public.analysis_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Match reference
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  
  -- Cache key components
  tier varchar(10) NOT NULL CHECK (tier IN ('basic', 'pro')),
  
  -- Cached result
  result jsonb NOT NULL,
  
  -- Cache metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + INTERVAL '1 hour',
  
  -- Unique constraint for cache key
  CONSTRAINT unique_match_tier_cache UNIQUE (match_id, tier)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_analysis_cache_match ON public.analysis_cache(match_id);
CREATE INDEX IF NOT EXISTS idx_analysis_cache_tier ON public.analysis_cache(tier);
CREATE INDEX IF NOT EXISTS idx_analysis_cache_expires ON public.analysis_cache(expires_at);

-- Enable Row Level Security
ALTER TABLE public.analysis_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- 1) Authenticated users can view cache entries
DROP POLICY IF EXISTS analysis_cache_select_auth ON public.analysis_cache;
CREATE POLICY analysis_cache_select_auth ON public.analysis_cache
  FOR SELECT 
  USING (auth.uid() IS NOT NULL);

-- 2) Service role can insert/update/delete cache entries
DROP POLICY IF EXISTS analysis_cache_all_service ON public.analysis_cache;
CREATE POLICY analysis_cache_all_service ON public.analysis_cache
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Function to get cached analysis
CREATE OR REPLACE FUNCTION public.get_cached_analysis(
  p_match_id uuid,
  p_tier varchar(10)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
  v_result jsonb;
BEGIN
  SELECT result INTO v_result
  FROM public.analysis_cache
  WHERE match_id = p_match_id
    AND tier = p_tier
    AND expires_at > now();
  
  RETURN v_result;
END;
$;

-- Function to set cached analysis
CREATE OR REPLACE FUNCTION public.set_cached_analysis(
  p_match_id uuid,
  p_tier varchar(10),
  p_result jsonb,
  p_ttl_hours integer DEFAULT 1
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.analysis_cache (match_id, tier, result, expires_at)
  VALUES (p_match_id, p_tier, p_result, now() + (p_ttl_hours || ' hours')::interval)
  ON CONFLICT (match_id, tier) 
  DO UPDATE SET 
    result = EXCLUDED.result,
    expires_at = now() + (p_ttl_hours || ' hours')::interval,
    created_at = now()
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$;

-- Function to cleanup expired cache entries
CREATE OR REPLACE FUNCTION public.cleanup_expired_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.analysis_cache
  WHERE expires_at < now();
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$;

-- Comments for documentation
COMMENT ON TABLE public.analysis_cache IS 'Cache kết quả phân tích AI (TTL: 1 giờ)';
COMMENT ON COLUMN public.analysis_cache.tier IS 'Loại phân tích: basic | pro';
COMMENT ON COLUMN public.analysis_cache.result IS 'Kết quả phân tích (JSON)';
COMMENT ON COLUMN public.analysis_cache.expires_at IS 'Thời điểm hết hạn cache';
COMMENT ON FUNCTION public.get_cached_analysis IS 'Lấy kết quả phân tích từ cache';
COMMENT ON FUNCTION public.set_cached_analysis IS 'Lưu kết quả phân tích vào cache';
COMMENT ON FUNCTION public.cleanup_expired_cache IS 'Xóa các cache entry đã hết hạn';

-- Grant permissions
GRANT SELECT ON public.analysis_cache TO authenticated;
GRANT ALL ON public.analysis_cache TO service_role;
GRANT EXECUTE ON FUNCTION public.get_cached_analysis TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_cached_analysis TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_cache TO service_role;
