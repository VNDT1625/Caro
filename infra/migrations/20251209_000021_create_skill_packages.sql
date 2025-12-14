-- Migration: Create skill packages system
-- Date: 2025-12-09
-- Description: Tạo hệ thống package để mở skill theo spec skill.md

-- =====================================================
-- STEP 1: Create skill_packages table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.skill_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_code varchar(50) NOT NULL UNIQUE,
  name_vi varchar(100) NOT NULL,
  name_en varchar(100),
  description_vi text,
  description_en text,
  
  -- Package contents
  cards_count integer NOT NULL DEFAULT 5,
  
  -- Drop rates (must sum to 1.0)
  common_rate decimal(5,4) NOT NULL DEFAULT 0.7000,
  rare_rate decimal(5,4) NOT NULL DEFAULT 0.2500,
  legendary_rate decimal(5,4) NOT NULL DEFAULT 0.0500,
  
  -- Pricing
  price_tinh_thach integer DEFAULT 0,  -- Tinh Thạch (basic currency)
  price_nguyen_than integer DEFAULT 0, -- Nguyên Thần (premium currency)
  
  -- Availability
  source varchar(50) NOT NULL DEFAULT 'shop', -- 'shop', 'event', 'quest'
  is_active boolean DEFAULT true,
  
  -- Visuals
  icon_url text,
  background_color varchar(20) DEFAULT '#ffffff',
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  -- Constraint: rates must sum to 1
  CONSTRAINT valid_rates CHECK (common_rate + rare_rate + legendary_rate = 1.0000)
);

-- =====================================================
-- STEP 2: Create user_package_purchases table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_package_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.skill_packages(id),
  
  -- Purchase details
  price_paid_tinh_thach integer DEFAULT 0,
  price_paid_nguyen_than integer DEFAULT 0,
  
  -- Results (skills received)
  skills_received jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Format: [{"skill_id": "uuid", "skill_code": "SKL_001", "rarity": "common"}, ...]
  
  purchased_at timestamp with time zone DEFAULT now()
);

-- =====================================================
-- STEP 3: Seed 3 package types theo spec
-- =====================================================
INSERT INTO public.skill_packages (package_code, name_vi, name_en, description_vi, description_en, cards_count, common_rate, rare_rate, legendary_rate, price_tinh_thach, price_nguyen_than, source) VALUES
-- Khai Xuân: 80% thường, 19.9% hiếm, 0.1% cực hiếm - 10000 Tinh Thạch
('PKG_KHAI_XUAN', 'Khai Xuân', 'Spring Opening', 
 'Gói cơ bản với 5 thẻ skill. Tỷ lệ: 80% Thường, 19.9% Hiếm, 0.1% Cực Hiếm',
 'Basic pack with 5 skill cards. Rates: 80% Common, 19.9% Rare, 0.1% Ultra Rare',
 5, 0.8000, 0.1990, 0.0010, 10000, 0, 'shop'),

-- Khai Thiên: 60% thường, 35% hiếm, 5% cực hiếm - 1000 Nguyên Thần
('PKG_KHAI_THIEN', 'Khai Thiên', 'Heaven Opening',
 'Gói cao cấp với 5 thẻ skill. Tỷ lệ: 60% Thường, 35% Hiếm, 5% Cực Hiếm',
 'Premium pack with 5 skill cards. Rates: 60% Common, 35% Rare, 5% Ultra Rare',
 5, 0.6000, 0.3500, 0.0500, 0, 1000, 'shop'),

-- Vô Cực: 60% thường, 30% hiếm, 10% cực hiếm - 5000 Nguyên Thần
('PKG_VO_CUC', 'Vô Cực', 'Infinite',
 'Gói siêu cao cấp với 5 thẻ skill. Tỷ lệ: 60% Thường, 30% Hiếm, 10% Cực Hiếm',
 'Ultra premium pack with 5 skill cards. Rates: 60% Common, 30% Rare, 10% Ultra Rare',
 5, 0.6000, 0.3000, 0.1000, 0, 5000, 'shop');

-- =====================================================
-- STEP 4: Indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_skill_packages_active ON public.skill_packages(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_skill_packages_source ON public.skill_packages(source);
CREATE INDEX IF NOT EXISTS idx_user_package_purchases_user ON public.user_package_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_user_package_purchases_package ON public.user_package_purchases(package_id);

-- =====================================================
-- STEP 5: RLS Policies
-- =====================================================
ALTER TABLE public.skill_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_package_purchases ENABLE ROW LEVEL SECURITY;

-- Everyone can read active packages
CREATE POLICY "skill_packages_select_active" ON public.skill_packages
  FOR SELECT USING (is_active = true);

-- Users can read their own purchases
CREATE POLICY "user_package_purchases_select_own" ON public.user_package_purchases
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own purchases (via backend)
CREATE POLICY "user_package_purchases_insert_own" ON public.user_package_purchases
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can do everything
CREATE POLICY "skill_packages_admin_all" ON public.skill_packages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admin WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "user_package_purchases_admin_all" ON public.user_package_purchases
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admin WHERE user_id = auth.uid() AND is_active = true)
  );

-- =====================================================
-- STEP 6: Trigger for updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_skill_packages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER skill_packages_updated_at
  BEFORE UPDATE ON public.skill_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_skill_packages_updated_at();

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON TABLE public.skill_packages IS 'Skill card packages available for purchase';
COMMENT ON TABLE public.user_package_purchases IS 'History of user package purchases';
COMMENT ON COLUMN public.skill_packages.common_rate IS 'Drop rate for common skills (rarity=common)';
COMMENT ON COLUMN public.skill_packages.rare_rate IS 'Drop rate for rare skills (rarity=rare)';
COMMENT ON COLUMN public.skill_packages.legendary_rate IS 'Drop rate for legendary/ultra-rare skills (rarity=legendary)';
