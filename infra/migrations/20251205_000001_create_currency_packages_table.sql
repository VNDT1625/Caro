-- Migration: Create currency_packages table for coin/gem purchase packages
-- Date: 2025-12-05

-- Bảng gói nạp coin/gem
CREATE TABLE IF NOT EXISTS public.currency_packages (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    package_code VARCHAR(50) NOT NULL UNIQUE,
    name_vi VARCHAR(100) NOT NULL,
    name_en VARCHAR(100),
    description_vi TEXT,
    description_en TEXT,
    currency_type VARCHAR(10) NOT NULL CHECK (currency_type IN ('coin', 'gem')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    bonus_amount INTEGER DEFAULT 0 CHECK (bonus_amount >= 0),
    price_vnd INTEGER NOT NULL CHECK (price_vnd > 0),
    discount_percent INTEGER DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
    original_price_vnd INTEGER,
    icon_url TEXT,
    is_featured BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    valid_from TIMESTAMP WITH TIME ZONE,
    valid_until TIMESTAMP WITH TIME ZONE,
    max_purchases_per_user INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT currency_packages_pkey PRIMARY KEY (id)
);

-- Bảng lịch sử mua currency
CREATE TABLE IF NOT EXISTS public.currency_purchases (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    package_id uuid NOT NULL,
    txn_ref VARCHAR(50) NOT NULL UNIQUE,
    currency_type VARCHAR(10) NOT NULL CHECK (currency_type IN ('coin', 'gem')),
    amount INTEGER NOT NULL,
    bonus_amount INTEGER DEFAULT 0,
    total_amount INTEGER NOT NULL,
    price_vnd INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
    payment_method VARCHAR(20) DEFAULT 'vnpay',
    vnp_data JSONB,
    balance_before INTEGER,
    balance_after INTEGER,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    paid_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT currency_purchases_pkey PRIMARY KEY (id),
    CONSTRAINT currency_purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id),
    CONSTRAINT currency_purchases_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.currency_packages(id)
);

-- Index cho query nhanh
CREATE INDEX IF NOT EXISTS idx_currency_packages_active ON public.currency_packages(is_active, currency_type);
CREATE INDEX IF NOT EXISTS idx_currency_purchases_user ON public.currency_purchases(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_currency_purchases_txn ON public.currency_purchases(txn_ref);

-- RLS policies
ALTER TABLE public.currency_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currency_purchases ENABLE ROW LEVEL SECURITY;

-- Ai cũng có thể xem packages active
CREATE POLICY "Anyone can view active packages" ON public.currency_packages
    FOR SELECT USING (is_active = true);

-- User chỉ xem được purchase của mình
CREATE POLICY "Users can view own purchases" ON public.currency_purchases
    FOR SELECT USING (auth.uid() = user_id);

-- Insert sample packages
INSERT INTO public.currency_packages (package_code, name_vi, name_en, description_vi, description_en, currency_type, amount, bonus_amount, price_vnd, discount_percent, is_featured, sort_order) VALUES
-- Tinh Thạch (Coin) packages
('coin_100', '100 Tinh Thạch', '100 Spirit Stones', 'Gói Tinh Thạch cơ bản', 'Basic Spirit Stone pack', 'coin', 100, 0, 10000, 0, false, 1),
('coin_500', '500 Tinh Thạch', '500 Spirit Stones', 'Gói Tinh Thạch phổ biến', 'Popular Spirit Stone pack', 'coin', 500, 50, 45000, 10, false, 2),
('coin_1000', '1000 Tinh Thạch', '1000 Spirit Stones', 'Gói Tinh Thạch tiết kiệm', 'Value Spirit Stone pack', 'coin', 1000, 150, 80000, 20, true, 3),
('coin_2500', '2500 Tinh Thạch', '2500 Spirit Stones', 'Gói Tinh Thạch VIP', 'VIP Spirit Stone pack', 'coin', 2500, 500, 180000, 25, false, 4),
('coin_5000', '5000 Tinh Thạch', '5000 Spirit Stones', 'Gói Tinh Thạch Đại gia', 'Whale Spirit Stone pack', 'coin', 5000, 1500, 320000, 30, false, 5),
-- Nguyên Thần (Gem) packages
('gem_10', '10 Nguyên Thần', '10 Primordial Spirits', 'Gói Nguyên Thần nhỏ', 'Small Primordial Spirit pack', 'gem', 10, 0, 20000, 0, false, 10),
('gem_50', '50 Nguyên Thần', '50 Primordial Spirits', 'Gói Nguyên Thần phổ biến', 'Popular Primordial Spirit pack', 'gem', 50, 5, 90000, 10, false, 11),
('gem_100', '100 Nguyên Thần', '100 Primordial Spirits', 'Gói Nguyên Thần tiết kiệm', 'Value Primordial Spirit pack', 'gem', 100, 15, 160000, 20, true, 12),
('gem_250', '250 Nguyên Thần', '250 Primordial Spirits', 'Gói Nguyên Thần VIP', 'VIP Primordial Spirit pack', 'gem', 250, 50, 360000, 25, false, 13),
('gem_500', '500 Nguyên Thần', '500 Primordial Spirits', 'Gói Nguyên Thần Đại gia', 'Whale Primordial Spirit pack', 'gem', 500, 150, 640000, 30, false, 14)
ON CONFLICT (package_code) DO NOTHING;
