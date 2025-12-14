-- Migration: Create Subscriptions Table
-- Description: Tạo bảng subscriptions cho hệ thống quản lý tier người dùng
-- Date: 2024-12-03

-- Create enum for subscription tiers
DO $ BEGIN
  CREATE TYPE public.subscription_tier AS ENUM ('free', 'trial', 'pro', 'pro_plus');
EXCEPTION WHEN duplicate_object THEN NULL; END $;

-- Create enum for subscription status
DO $ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('active', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $;

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User reference
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  
  -- Subscription details
  tier public.subscription_tier NOT NULL DEFAULT 'free',
  status public.subscription_status NOT NULL DEFAULT 'active',
  
  -- Dates
  started_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  trial_started_at timestamptz,
  
  -- Settings
  auto_renew boolean DEFAULT false,
  
  -- Audit timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT unique_user_subscription UNIQUE (user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON public.subscriptions(tier);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires ON public.subscriptions(expires_at) WHERE expires_at IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- 1) Users can view their own subscription
DROP POLICY IF EXISTS subscriptions_select_own ON public.subscriptions;
CREATE POLICY subscriptions_select_own ON public.subscriptions
  FOR SELECT 
  USING (auth.uid() = user_id);

-- 2) Users can insert their own subscription (for initial creation)
DROP POLICY IF EXISTS subscriptions_insert_own ON public.subscriptions;
CREATE POLICY subscriptions_insert_own ON public.subscriptions
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- 3) Users can update their own subscription (for trial activation)
DROP POLICY IF EXISTS subscriptions_update_own ON public.subscriptions;
CREATE POLICY subscriptions_update_own ON public.subscriptions
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- 4) Admins can view all subscriptions
DROP POLICY IF EXISTS subscriptions_select_admin ON public.subscriptions;
CREATE POLICY subscriptions_select_admin ON public.subscriptions
  FOR SELECT 
  USING (public.is_admin(auth.uid()));

-- 5) Admins can update all subscriptions
DROP POLICY IF EXISTS subscriptions_update_admin ON public.subscriptions;
CREATE POLICY subscriptions_update_admin ON public.subscriptions
  FOR UPDATE 
  USING (public.is_admin(auth.uid()));

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_subscriptions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trigger_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_subscriptions_updated_at();

-- Comments for documentation
COMMENT ON TABLE public.subscriptions IS 'Quản lý subscription tier của người dùng';
COMMENT ON COLUMN public.subscriptions.tier IS 'Cấp độ: free | trial | pro | pro_plus';
COMMENT ON COLUMN public.subscriptions.status IS 'Trạng thái: active | cancelled | expired';
COMMENT ON COLUMN public.subscriptions.trial_started_at IS 'Ngày bắt đầu trial (7 ngày)';
COMMENT ON COLUMN public.subscriptions.expires_at IS 'Ngày hết hạn subscription';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
