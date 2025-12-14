-- Migration: Rank System V2
-- Cập nhật hệ thống rank với sub-ranks và decay system

-- 1. Thêm columns mới vào profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS rank_tier VARCHAR(20) DEFAULT 'so_ky' 
    CHECK (rank_tier IN ('so_ky', 'trung_ky', 'cao_ky', 'vuot_cap'));

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS rank_level INTEGER DEFAULT 1 
    CHECK (rank_level >= 1 AND rank_level <= 3);

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS season_matches INTEGER DEFAULT 0;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS soft_demoted BOOLEAN DEFAULT false;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS soft_demoted_at TIMESTAMP WITH TIME ZONE;

-- 2. Cập nhật constraint cho current_rank (thêm ranks mới)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_current_rank_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_current_rank_check 
    CHECK (current_rank IN (
        'vo_danh', 'tan_ky', 'hoc_ky', 'ky_lao', 
        'cao_ky', 'tam_ky', 'de_nhi', 'vo_doi'
    ));

-- 3. Tạo bảng seasons
CREATE TABLE IF NOT EXISTS seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_number INTEGER NOT NULL UNIQUE,
    season_name VARCHAR(100),
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT false,
    decay_processed BOOLEAN DEFAULT false,
    decay_processed_at TIMESTAMP WITH TIME ZONE,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index cho seasons
CREATE INDEX IF NOT EXISTS idx_seasons_active ON seasons(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_seasons_dates ON seasons(start_date, end_date);

-- 4. Tạo bảng rank_decay_logs
CREATE TABLE IF NOT EXISTS rank_decay_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(user_id),
    season_id UUID NOT NULL REFERENCES seasons(id),
    pre_rank VARCHAR(20) NOT NULL,
    pre_tier VARCHAR(20),
    pre_level INTEGER,
    pre_points INTEGER NOT NULL,
    post_rank VARCHAR(20) NOT NULL,
    post_tier VARCHAR(20),
    post_level INTEGER,
    post_points INTEGER NOT NULL,
    matches_played INTEGER NOT NULL,
    activity_multiplier DECIMAL(3,2) NOT NULL,
    decay_amount INTEGER NOT NULL,
    soft_demoted BOOLEAN DEFAULT false,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes cho rank_decay_logs
CREATE INDEX IF NOT EXISTS idx_decay_logs_user ON rank_decay_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_decay_logs_season ON rank_decay_logs(season_id);
CREATE INDEX IF NOT EXISTS idx_decay_logs_created ON rank_decay_logs(created_at DESC);

-- 5. Tạo bảng rank_config (cấu hình có thể điều chỉnh)
CREATE TABLE IF NOT EXISTS rank_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES profiles(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert default configs
INSERT INTO rank_config (config_key, config_value, description) VALUES
('points_per_subrank', '100', 'Điểm cần để lên 1 sub-rank'),
('decay_percentages', '{
    "vo_danh": 0.00,
    "tan_ky": 0.20,
    "hoc_ky": 0.18,
    "ky_lao": 0.15,
    "cao_ky": 0.12,
    "tam_ky": 0.10,
    "de_nhi": 0.08,
    "vo_doi": 0.05
}', 'Tỷ lệ decay theo rank'),
('activity_thresholds', '{
    "active": 20,
    "moderate": 10,
    "low": 1
}', 'Ngưỡng số trận để xác định activity level'),
('activity_multipliers', '{
    "active": 0.0,
    "moderate": 0.5,
    "low": 1.0,
    "inactive": 1.5
}', 'Hệ số decay theo activity level'),
('rank_floors', '{
    "vo_danh": 0,
    "tan_ky": 900,
    "hoc_ky": 1800,
    "ky_lao": 2800,
    "cao_ky": 4000,
    "tam_ky": 5500,
    "de_nhi": 7500,
    "vo_doi": 10000
}', 'Điểm tối thiểu để giữ rank'),
('soft_demotion_days', '14', 'Số ngày probation khi soft-demoted')
ON CONFLICT (config_key) DO NOTHING;

-- 6. Tạo season đầu tiên (Season 1)
INSERT INTO seasons (season_number, season_name, start_date, end_date, is_active) VALUES
(1, 'Mùa 1 - Khởi Đầu', now(), now() + INTERVAL '3 months', true)
ON CONFLICT (season_number) DO NOTHING;

-- 7. Function để reset season_matches khi mùa mới bắt đầu
CREATE OR REPLACE FUNCTION reset_season_matches()
RETURNS void AS $$
BEGIN
    UPDATE profiles SET season_matches = 0;
END;
$$ LANGUAGE plpgsql;

-- 8. Function để tăng season_matches sau mỗi trận ranked
CREATE OR REPLACE FUNCTION increment_season_matches()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.match_type = 'ranked' AND NEW.result IS NOT NULL THEN
        -- Tăng cho cả 2 players
        UPDATE profiles SET season_matches = season_matches + 1 
        WHERE user_id IN (NEW.player_x_user_id, NEW.player_o_user_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger cho matches
DROP TRIGGER IF EXISTS trg_increment_season_matches ON matches;
CREATE TRIGGER trg_increment_season_matches
    AFTER UPDATE OF result ON matches
    FOR EACH ROW
    WHEN (OLD.result IS NULL AND NEW.result IS NOT NULL)
    EXECUTE FUNCTION increment_season_matches();

-- 9. View để xem rank đầy đủ
CREATE OR REPLACE VIEW v_player_ranks AS
SELECT 
    p.user_id,
    p.username,
    p.display_name,
    p.current_rank,
    p.rank_tier,
    p.rank_level,
    p.mindpoint,
    p.season_matches,
    p.soft_demoted,
    p.soft_demoted_at,
    CASE 
        WHEN p.current_rank IN ('vo_danh', 'tan_ky', 'hoc_ky') 
             AND p.rank_tier != 'vuot_cap' THEN 'low'
        ELSE 'high'
    END as rank_phase,
    CASE p.current_rank
        WHEN 'vo_danh' THEN 'Vô Danh'
        WHEN 'tan_ky' THEN 'Tân Kỳ'
        WHEN 'hoc_ky' THEN 'Học Kỳ'
        WHEN 'ky_lao' THEN 'Kỳ Lão'
        WHEN 'cao_ky' THEN 'Cao Kỳ'
        WHEN 'tam_ky' THEN 'Tam Kỳ'
        WHEN 'de_nhi' THEN 'Đệ Nhị'
        WHEN 'vo_doi' THEN 'Vô Đối'
    END as rank_name_vi,
    CASE p.rank_tier
        WHEN 'so_ky' THEN 'Sơ Kỳ'
        WHEN 'trung_ky' THEN 'Trung Kỳ'
        WHEN 'cao_ky' THEN 'Cao Kỳ'
        WHEN 'vuot_cap' THEN 'Vượt Cấp'
    END as tier_name_vi
FROM profiles p;

-- 10. RLS policies cho bảng mới
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE rank_decay_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rank_config ENABLE ROW LEVEL SECURITY;

-- Seasons: ai cũng đọc được
CREATE POLICY "Seasons are viewable by everyone" ON seasons
    FOR SELECT USING (true);

-- Decay logs: chỉ xem của mình
CREATE POLICY "Users can view own decay logs" ON rank_decay_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Config: ai cũng đọc được
CREATE POLICY "Config is viewable by everyone" ON rank_config
    FOR SELECT USING (true);

COMMENT ON TABLE seasons IS 'Quản lý các mùa giải ranked';
COMMENT ON TABLE rank_decay_logs IS 'Log decay điểm cuối mùa';
COMMENT ON TABLE rank_config IS 'Cấu hình hệ thống rank (có thể điều chỉnh)';
