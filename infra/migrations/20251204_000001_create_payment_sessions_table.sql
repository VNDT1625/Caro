-- Migration: Create Payment Sessions Table
-- Description: Lưu trữ payment sessions từ VNPay để tránh mất dữ liệu khi backend restart
-- Date: 2025-12-04

-- Create enum for payment status
DO $ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'failed', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $;

-- Create payment_sessions table
CREATE TABLE IF NOT EXISTS public.payment_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Transaction reference
  txn_ref VARCHAR(50) NOT NULL UNIQUE,
  
  -- User reference
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  
  -- Payment details
  plan VARCHAR(20) NOT NULL, -- 'trial', 'pro', 'pro_plus'
  amount INTEGER NOT NULL, -- Amount in VND
  status public.payment_status NOT NULL DEFAULT 'pending',
  
  -- VNPay response data (JSON)
  vnp_data JSONB,
  
  -- Dates
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  
  -- Metadata
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  -- Constraints
  CONSTRAINT valid_plan CHECK (plan IN ('trial', 'pro', 'pro_plus')),
  CONSTRAINT valid_amount CHECK (amount > 0)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_sessions_txn_ref ON public.payment_sessions(txn_ref);
CREATE INDEX IF NOT EXISTS idx_payment_sessions_user ON public.payment_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_sessions_status ON public.payment_sessions(status);
CREATE INDEX IF NOT EXISTS idx_payment_sessions_created ON public.payment_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_sessions_expires ON public.payment_sessions(expires_at);

-- Enable Row Level Security
ALTER TABLE public.payment_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- 1) Users can view their own payment sessions
DROP POLICY IF EXISTS payment_sessions_select_own ON public.payment_sessions;
CREATE POLICY payment_sessions_select_own ON public.payment_sessions
  FOR SELECT 
  USING (auth.uid() = user_id);

-- 2) Admins can view all payment sessions
DROP POLICY IF EXISTS payment_sessions_select_admin ON public.payment_sessions;
CREATE POLICY payment_sessions_select_admin ON public.payment_sessions
  FOR SELECT 
  USING (public.is_admin(auth.uid()));

-- 3) Service role can insert/update (for webhook processing)
DROP POLICY IF EXISTS payment_sessions_insert_service ON public.payment_sessions;
CREATE POLICY payment_sessions_insert_service ON public.payment_sessions
  FOR INSERT 
  WITH CHECK (true);

DROP POLICY IF EXISTS payment_sessions_update_service ON public.payment_sessions;
CREATE POLICY payment_sessions_update_service ON public.payment_sessions
  FOR UPDATE 
  USING (true);

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_payment_sessions_updated_at()
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
DROP TRIGGER IF EXISTS trigger_payment_sessions_updated_at ON public.payment_sessions;
CREATE TRIGGER trigger_payment_sessions_updated_at
  BEFORE UPDATE ON public.payment_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_payment_sessions_updated_at();

-- Comments for documentation
COMMENT ON TABLE public.payment_sessions IS 'Lưu trữ payment sessions từ VNPay';
COMMENT ON COLUMN public.payment_sessions.txn_ref IS 'Transaction reference từ VNPay';
COMMENT ON COLUMN public.payment_sessions.status IS 'Trạng thái: pending | paid | failed | cancelled | expired';
COMMENT ON COLUMN public.payment_sessions.vnp_data IS 'Response data từ VNPay (JSON)';

-- Grant permissions
GRANT SELECT ON public.payment_sessions TO authenticated;
GRANT ALL ON public.payment_sessions TO service_role;
