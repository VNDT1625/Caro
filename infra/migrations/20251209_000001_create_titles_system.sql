-- =====================================================
-- HỆ THỐNG DANH HIỆU (TITLE SYSTEM)
-- Danh hiệu đạt được qua thành tích, KHÔNG MUA ĐƯỢC
-- =====================================================

-- Bảng định nghĩa danh hiệu
CREATE TABLE IF NOT EXISTS titles (
    id TEXT PRIMARY KEY,
    name_vi TEXT NOT NULL,
    name_en TEXT NOT NULL,
    description_vi TEXT,
    description_en TEXT,
    category TEXT NOT NULL CHECK (category IN ('rank', 'wins', 'streak', 'special', 'season', 'social', 'skill', 'event')),
    rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary', 'mythic')),
    icon TEXT,
    color TEXT DEFAULT '#22D3EE',
    glow_color TEXT,
    requirement_type TEXT NOT NULL, -- 'rank_reach', 'wins_total', 'wins_streak', 'season_rank', 'tournament_win', 'special_event', etc.
    requirement_value JSONB NOT NULL DEFAULT '{}', -- {"rank": "master", "wins": 100, etc.}
    points INTEGER DEFAULT 0, -- điểm thành tích
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng user đã đạt danh hiệu nào
CREATE TABLE IF NOT EXISTS user_titles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title_id TEXT NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    is_equipped BOOLEAN DEFAULT false, -- đang trang bị hiển thị
    UNIQUE(user_id, title_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_user_titles_user ON user_titles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_titles_equipped ON user_titles(user_id, is_equipped) WHERE is_equipped = true;
CREATE INDEX IF NOT EXISTS idx_titles_category ON titles(category);
CREATE INDEX IF NOT EXISTS idx_titles_rarity ON titles(rarity);

-- RLS
ALTER TABLE titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_titles ENABLE ROW LEVEL SECURITY;

-- Titles: ai cũng đọc được
CREATE POLICY "titles_read_all" ON titles FOR SELECT USING (true);

-- User titles: user đọc của mình, insert/update của mình
CREATE POLICY "user_titles_read_own" ON user_titles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_titles_insert_own" ON user_titles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_titles_update_own" ON user_titles FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- SEED 50 DANH HIỆU
-- =====================================================

INSERT INTO titles (id, name_vi, name_en, description_vi, description_en, category, rarity, icon, color, glow_color, requirement_type, requirement_value, points, sort_order) VALUES

-- ========== RANK TITLES (10) ==========
('rank_bronze', 'Tân Thủ', 'Novice', 'Đạt hạng Đồng', 'Reach Bronze rank', 'rank', 'common', '🥉', '#CD7F32', '#CD7F3280', 'rank_reach', '{"rank": "bronze"}', 10, 1),
('rank_silver', 'Kiếm Khách', 'Swordsman', 'Đạt hạng Bạc', 'Reach Silver rank', 'rank', 'common', '🥈', '#C0C0C0', '#C0C0C080', 'rank_reach', '{"rank": "silver"}', 20, 2),
('rank_gold', 'Cao Thủ', 'Expert', 'Đạt hạng Vàng', 'Reach Gold rank', 'rank', 'rare', '🥇', '#FFD700', '#FFD70080', 'rank_reach', '{"rank": "gold"}', 50, 3),
('rank_platinum', 'Đại Sư', 'Master', 'Đạt hạng Bạch Kim', 'Reach Platinum rank', 'rank', 'rare', '💎', '#E5E4E2', '#E5E4E280', 'rank_reach', '{"rank": "platinum"}', 100, 4),
('rank_diamond', 'Kim Cương Thủ', 'Diamond Hand', 'Đạt hạng Kim Cương', 'Reach Diamond rank', 'rank', 'epic', '💠', '#B9F2FF', '#B9F2FF80', 'rank_reach', '{"rank": "diamond"}', 200, 5),
('rank_master', 'Tông Sư', 'Grandmaster', 'Đạt hạng Cao Thủ', 'Reach Master rank', 'rank', 'epic', '👑', '#9B59B6', '#9B59B680', 'rank_reach', '{"rank": "master"}', 300, 6),
('rank_grandmaster', 'Đại Tông Sư', 'Legend', 'Đạt hạng Đại Cao Thủ', 'Reach Grandmaster rank', 'rank', 'legendary', '🏆', '#F39C12', '#F39C1280', 'rank_reach', '{"rank": "grandmaster"}', 500, 7),
('rank_challenger', 'Thiên Hạ Đệ Nhất', 'Challenger', 'Đạt hạng Thách Đấu', 'Reach Challenger rank', 'rank', 'mythic', '⚡', '#E74C3C', '#E74C3C80', 'rank_reach', '{"rank": "challenger"}', 1000, 8),
('rank_top10', 'Thập Đại Cao Thủ', 'Top 10', 'Lọt Top 10 bảng xếp hạng', 'Reach Top 10 leaderboard', 'rank', 'mythic', '🔱', '#8E44AD', '#8E44AD80', 'leaderboard_position', '{"position": 10}', 800, 9),
('rank_top1', 'Vô Địch Thiên Hạ', 'World Champion', 'Đứng đầu bảng xếp hạng', 'Reach #1 on leaderboard', 'rank', 'mythic', '👸', '#E91E63', '#E91E6380', 'leaderboard_position', '{"position": 1}', 2000, 10),

-- ========== WIN TITLES (10) ==========
('wins_10', 'Sơ Nhập Giang Hồ', 'First Steps', 'Thắng 10 trận', 'Win 10 matches', 'wins', 'common', '⚔️', '#3498DB', '#3498DB80', 'wins_total', '{"wins": 10}', 10, 11),
('wins_50', 'Chiến Binh', 'Warrior', 'Thắng 50 trận', 'Win 50 matches', 'wins', 'common', '🗡️', '#2ECC71', '#2ECC7180', 'wins_total', '{"wins": 50}', 30, 12),
('wins_100', 'Bách Chiến Bách Thắng', 'Centurion', 'Thắng 100 trận', 'Win 100 matches', 'wins', 'rare', '🛡️', '#E67E22', '#E67E2280', 'wins_total', '{"wins": 100}', 100, 13),
('wins_250', 'Chiến Thần', 'War God', 'Thắng 250 trận', 'Win 250 matches', 'wins', 'rare', '⚡', '#9B59B6', '#9B59B680', 'wins_total', '{"wins": 250}', 200, 14),
('wins_500', 'Ngũ Bách Chiến Tướng', 'Commander', 'Thắng 500 trận', 'Win 500 matches', 'wins', 'epic', '🎖️', '#1ABC9C', '#1ABC9C80', 'wins_total', '{"wins": 500}', 400, 15),
('wins_1000', 'Thiên Chiến Vương', 'Warlord', 'Thắng 1000 trận', 'Win 1000 matches', 'wins', 'legendary', '👑', '#F1C40F', '#F1C40F80', 'wins_total', '{"wins": 1000}', 800, 16),
('wins_2500', 'Vạn Chiến Bất Bại', 'Invincible', 'Thắng 2500 trận', 'Win 2500 matches', 'wins', 'legendary', '🔥', '#E74C3C', '#E74C3C80', 'wins_total', '{"wins": 2500}', 1500, 17),
('wins_5000', 'Huyền Thoại Sống', 'Living Legend', 'Thắng 5000 trận', 'Win 5000 matches', 'wins', 'mythic', '🌟', '#9B59B6', '#9B59B680', 'wins_total', '{"wins": 5000}', 3000, 18),
('wins_perfect_10', 'Hoàn Hảo', 'Perfect', 'Thắng 10 trận liên tiếp không thua', 'Win 10 matches without losing', 'wins', 'epic', '💯', '#2ECC71', '#2ECC7180', 'wins_streak', '{"streak": 10}', 300, 19),
('wins_perfect_25', 'Bất Khả Chiến Bại', 'Undefeated', 'Thắng 25 trận liên tiếp', 'Win 25 matches in a row', 'wins', 'legendary', '🏅', '#F39C12', '#F39C1280', 'wins_streak', '{"streak": 25}', 600, 20),

-- ========== STREAK TITLES (5) ==========
('streak_3', 'Tam Liên Thắng', 'Hat Trick', 'Thắng 3 trận liên tiếp', 'Win 3 matches in a row', 'streak', 'common', '3️⃣', '#3498DB', '#3498DB80', 'wins_streak', '{"streak": 3}', 15, 21),
('streak_5', 'Ngũ Liên Thắng', 'Penta Kill', 'Thắng 5 trận liên tiếp', 'Win 5 matches in a row', 'streak', 'rare', '5️⃣', '#E67E22', '#E67E2280', 'wins_streak', '{"streak": 5}', 50, 22),
('streak_7', 'Thất Tinh Liên Châu', 'Lucky Seven', 'Thắng 7 trận liên tiếp', 'Win 7 matches in a row', 'streak', 'epic', '7️⃣', '#9B59B6', '#9B59B680', 'wins_streak', '{"streak": 7}', 100, 23),
('streak_comeback', 'Phượng Hoàng Tái Sinh', 'Phoenix', 'Thắng sau khi thua 5 trận liên tiếp', 'Win after 5 loss streak', 'streak', 'rare', '🔥', '#E74C3C', '#E74C3C80', 'comeback', '{"loss_streak": 5}', 80, 24),
('streak_revenge', 'Báo Thù', 'Revenge', 'Thắng lại người vừa đánh bại mình', 'Beat someone who just beat you', 'streak', 'common', '💢', '#C0392B', '#C0392B80', 'revenge_win', '{}', 25, 25),

-- ========== SPECIAL TITLES (10) ==========
('special_first_win', 'Khởi Đầu Mới', 'First Blood', 'Thắng trận đầu tiên', 'Win your first match', 'special', 'common', '🎯', '#2ECC71', '#2ECC7180', 'first_win', '{}', 5, 26),
('special_quick_win', 'Tốc Chiến Tốc Thắng', 'Speed Demon', 'Thắng trong vòng 20 nước', 'Win within 20 moves', 'special', 'rare', '⚡', '#F39C12', '#F39C1280', 'quick_win', '{"moves": 20}', 50, 27),
('special_long_game', 'Trường Kỳ Kháng Chiến', 'Marathon', 'Thắng trận đấu trên 100 nước', 'Win a match over 100 moves', 'special', 'rare', '🏃', '#3498DB', '#3498DB80', 'long_game_win', '{"moves": 100}', 50, 28),
('special_comeback_win', 'Đảo Ngược Tình Thế', 'Comeback King', 'Thắng khi đối thủ có 4 quân liên tiếp', 'Win when opponent had 4 in a row', 'special', 'epic', '🔄', '#9B59B6', '#9B59B680', 'comeback_win', '{}', 100, 29),
('special_no_mistake', 'Không Sai Một Nước', 'Flawless', 'Thắng mà không mắc lỗi nào (AI đánh giá)', 'Win without any mistakes (AI rated)', 'special', 'legendary', '✨', '#F1C40F', '#F1C40F80', 'perfect_game', '{}', 300, 30),
('special_underdog', 'Kẻ Yếu Chiến Thắng', 'Underdog', 'Thắng người có rank cao hơn 2 bậc', 'Beat someone 2+ ranks higher', 'special', 'epic', '🐕', '#E67E22', '#E67E2280', 'underdog_win', '{"rank_diff": 2}', 150, 31),
('special_giant_slayer', 'Diệt Khổng Lồ', 'Giant Slayer', 'Thắng người trong Top 100', 'Beat a Top 100 player', 'special', 'legendary', '🗡️', '#E74C3C', '#E74C3C80', 'beat_top_player', '{"top": 100}', 400, 32),
('special_night_owl', 'Cú Đêm', 'Night Owl', 'Thắng 10 trận sau 12h đêm', 'Win 10 matches after midnight', 'special', 'rare', '🦉', '#34495E', '#34495E80', 'night_wins', '{"wins": 10, "hour_start": 0, "hour_end": 5}', 60, 33),
('special_early_bird', 'Chim Sớm', 'Early Bird', 'Thắng 10 trận trước 7h sáng', 'Win 10 matches before 7 AM', 'special', 'rare', '🐦', '#F39C12', '#F39C1280', 'early_wins', '{"wins": 10, "hour_start": 5, "hour_end": 7}', 60, 34),
('special_weekend_warrior', 'Chiến Binh Cuối Tuần', 'Weekend Warrior', 'Thắng 20 trận vào cuối tuần', 'Win 20 matches on weekends', 'special', 'rare', '🎮', '#9B59B6', '#9B59B680', 'weekend_wins', '{"wins": 20}', 70, 35),

-- ========== SEASON TITLES (5) ==========
('season_1_participant', 'Tiên Phong Mùa 1', 'Season 1 Pioneer', 'Tham gia Mùa 1', 'Participated in Season 1', 'season', 'rare', '🏁', '#3498DB', '#3498DB80', 'season_participate', '{"season": 1}', 50, 36),
('season_1_gold', 'Vàng Mùa 1', 'Season 1 Gold', 'Đạt hạng Vàng Mùa 1', 'Reach Gold in Season 1', 'season', 'epic', '🥇', '#FFD700', '#FFD70080', 'season_rank', '{"season": 1, "rank": "gold"}', 150, 37),
('season_1_champion', 'Vô Địch Mùa 1', 'Season 1 Champion', 'Top 1 Mùa 1', 'Finish #1 in Season 1', 'season', 'mythic', '🏆', '#E91E63', '#E91E6380', 'season_champion', '{"season": 1}', 1000, 38),
('season_veteran', 'Lão Làng', 'Veteran', 'Chơi qua 3 mùa giải', 'Play through 3 seasons', 'season', 'epic', '🎖️', '#795548', '#79554880', 'seasons_played', '{"seasons": 3}', 200, 39),
('season_consistent', 'Kiên Định', 'Consistent', 'Đạt Gold+ trong 3 mùa liên tiếp', 'Reach Gold+ for 3 consecutive seasons', 'season', 'legendary', '💪', '#2ECC71', '#2ECC7180', 'consecutive_gold', '{"seasons": 3}', 400, 40),

-- ========== SOCIAL TITLES (5) ==========
('social_friendly', 'Thân Thiện', 'Friendly', 'Chơi với 50 người khác nhau', 'Play with 50 different players', 'social', 'common', '🤝', '#3498DB', '#3498DB80', 'unique_opponents', '{"count": 50}', 30, 41),
('social_popular', 'Nổi Tiếng', 'Popular', 'Được 100 người theo dõi', 'Get 100 followers', 'social', 'rare', '⭐', '#F39C12', '#F39C1280', 'followers', '{"count": 100}', 100, 42),
('social_mentor', 'Sư Phụ', 'Mentor', 'Giúp 10 người mới đạt hạng Bạc', 'Help 10 newbies reach Silver', 'social', 'epic', '📚', '#9B59B6', '#9B59B680', 'mentored_players', '{"count": 10}', 200, 43),
('social_streamer', 'Streamer', 'Streamer', 'Có 1000 lượt xem replay', 'Get 1000 replay views', 'social', 'rare', '📺', '#E74C3C', '#E74C3C80', 'replay_views', '{"count": 1000}', 80, 44),
('social_influencer', 'Người Ảnh Hưởng', 'Influencer', 'Có 500 người theo dõi', 'Get 500 followers', 'social', 'legendary', '🌟', '#E91E63', '#E91E6380', 'followers', '{"count": 500}', 300, 45),

-- ========== SKILL TITLES (5) ==========
('skill_analyst', 'Nhà Phân Tích', 'Analyst', 'Xem 50 bản phân tích AI', 'View 50 AI analyses', 'skill', 'common', '🔍', '#3498DB', '#3498DB80', 'analyses_viewed', '{"count": 50}', 20, 46),
('skill_learner', 'Học Trò Chăm Chỉ', 'Dedicated Learner', 'Hoàn thành 20 bài học', 'Complete 20 lessons', 'skill', 'rare', '📖', '#2ECC71', '#2ECC7180', 'lessons_completed', '{"count": 20}', 60, 47),
('skill_strategist', 'Chiến Lược Gia', 'Strategist', 'Sử dụng 100 skill trong trận', 'Use 100 skills in matches', 'skill', 'rare', '🧠', '#9B59B6', '#9B59B680', 'skills_used', '{"count": 100}', 80, 48),
('skill_combo_master', 'Bậc Thầy Combo', 'Combo Master', 'Thực hiện 50 combo skill', 'Execute 50 skill combos', 'skill', 'epic', '💥', '#E67E22', '#E67E2280', 'combos_executed', '{"count": 50}', 150, 49),
('skill_perfectionist', 'Người Cầu Toàn', 'Perfectionist', 'Đạt điểm phân tích 95+ trong 10 trận', 'Get 95+ analysis score in 10 matches', 'skill', 'legendary', '💎', '#F1C40F', '#F1C40F80', 'high_score_games', '{"score": 95, "count": 10}', 400, 50)

ON CONFLICT (id) DO UPDATE SET
    name_vi = EXCLUDED.name_vi,
    name_en = EXCLUDED.name_en,
    description_vi = EXCLUDED.description_vi,
    description_en = EXCLUDED.description_en,
    category = EXCLUDED.category,
    rarity = EXCLUDED.rarity,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color,
    glow_color = EXCLUDED.glow_color,
    requirement_type = EXCLUDED.requirement_type,
    requirement_value = EXCLUDED.requirement_value,
    points = EXCLUDED.points,
    sort_order = EXCLUDED.sort_order;
