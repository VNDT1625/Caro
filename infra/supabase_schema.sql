-- infra/supabase_schema.sql
-- Supabase-ready schema for MindPoint Arena (MVP)
-- Key changes vs original: use Supabase Auth + `profiles` (linked to auth.users),
-- prefer `pgcrypto` + `gen_random_uuid()` for UUIDs, remove credential fields,
-- include basic RLS policies and safe seed data (achievements, items).

-- NOTE: Run this in your Supabase SQL editor. Server-side operations should use
-- the Supabase service_role key to bypass RLS when needed.

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- 1) PROFILES (link to Supabase Auth `auth.users`)
-- =====================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(50),
  display_name VARCHAR(100),
  avatar_url TEXT,
  settings JSONB DEFAULT '{}'::jsonb,

  -- ranking & stats
  current_rank VARCHAR(50) DEFAULT 'vo_danh',
  mindpoint INTEGER DEFAULT 0,
  elo_rating INTEGER DEFAULT 1000,
  total_matches INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  total_losses INTEGER DEFAULT 0,
  total_draws INTEGER DEFAULT 0,
  win_streak INTEGER DEFAULT 0,
  best_win_streak INTEGER DEFAULT 0,

  coins INTEGER DEFAULT 0,
  gems INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_profiles_userid ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_mindpoint ON profiles(mindpoint DESC, elo_rating DESC);

-- =====================================================================
-- 2) ROOMS
-- =====================================================================
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code VARCHAR(10) UNIQUE,
  owner_user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,

  room_name VARCHAR(100),
  mode VARCHAR(50) NOT NULL DEFAULT 'casual',
  is_private BOOLEAN DEFAULT false,
  invite_token VARCHAR(128),
  max_players INTEGER DEFAULT 2,

  board_size INTEGER DEFAULT 15,
  win_length INTEGER DEFAULT 5,
  time_per_move INTEGER DEFAULT 30,

  status VARCHAR(20) DEFAULT 'waiting', -- waiting, playing, finished
  current_players INTEGER DEFAULT 1,

  game_config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status, is_private);
CREATE INDEX IF NOT EXISTS idx_rooms_owner ON rooms(owner_user_id);

-- =====================================================================
-- 3) ROOM_PLAYERS
-- =====================================================================
CREATE TABLE IF NOT EXISTS room_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  player_side VARCHAR(10), -- X / O / team_a / team_b
  player_order INTEGER,
  is_ready BOOLEAN DEFAULT false,
  is_spectator BOOLEAN DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  left_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_players_room ON room_players(room_id);
CREATE INDEX IF NOT EXISTS idx_room_players_user ON room_players(user_id);

-- =====================================================================
-- 4) MATCHES
-- =====================================================================
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  match_type VARCHAR(50) NOT NULL DEFAULT 'casual',

  player_x_user_id UUID NOT NULL REFERENCES profiles(user_id),
  player_o_user_id UUID REFERENCES profiles(user_id), -- NULL if AI
  winner_user_id UUID REFERENCES profiles(user_id),
  result VARCHAR(20), -- win_x, win_o, draw, abandoned
  win_condition VARCHAR(50),

  total_moves INTEGER DEFAULT 0,
  duration_seconds INTEGER,
  avg_move_time DECIMAL(6,2),

  player_x_mindpoint_change INTEGER DEFAULT 0,
  player_o_mindpoint_change INTEGER DEFAULT 0,

  board_size INTEGER DEFAULT 15,
  win_length INTEGER DEFAULT 5,
  final_board_state JSONB,

  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_matches_players ON matches(player_x_user_id, player_o_user_id);
CREATE INDEX IF NOT EXISTS idx_matches_room ON matches(room_id);

-- =====================================================================
-- 5) MOVES
-- =====================================================================
CREATE TABLE IF NOT EXISTS moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_user_id UUID NOT NULL REFERENCES profiles(user_id),
  move_number INTEGER NOT NULL,
  position_x INTEGER NOT NULL,
  position_y INTEGER NOT NULL,
  time_taken INTEGER,
  time_remaining INTEGER,
  skill_used VARCHAR(50),
  skill_effect JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(match_id, move_number)
);

CREATE INDEX IF NOT EXISTS idx_moves_match ON moves(match_id, move_number);
CREATE INDEX IF NOT EXISTS idx_moves_player ON moves(player_user_id);

-- =====================================================================
-- 6) CHAT_MESSAGES
-- =====================================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  message_type VARCHAR(20) DEFAULT 'text',
  content TEXT NOT NULL,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_room ON chat_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_match ON chat_messages(match_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sender ON chat_messages(sender_user_id);

-- =====================================================================
-- 7) ACHIEVEMENTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  achievement_code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  requirement_type VARCHAR(50),
  requirement_value INTEGER,
  reward_coins INTEGER DEFAULT 0,
  reward_gems INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_achievements_code ON achievements(achievement_code);

-- =====================================================================
-- 8) ITEMS
-- =====================================================================
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  price_coins INTEGER DEFAULT 0,
  price_gems INTEGER DEFAULT 0,
  is_premium BOOLEAN DEFAULT false,
  rarity VARCHAR(20),
  preview_url TEXT,
  asset_data JSONB,
  is_available BOOLEAN DEFAULT true,
  release_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_items_code ON items(item_code);

-- =====================================================================
-- 9) TRANSACTIONS
-- =====================================================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL,
  currency_type VARCHAR(20) NOT NULL,
  amount INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reason VARCHAR(255),
  related_entity_type VARCHAR(50),
  related_entity_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id, created_at DESC);

-- =====================================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================================

-- update_updated_at_column: keep updated_at current
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach to some tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at') THEN
    CREATE TRIGGER update_profiles_updated_at
      BEFORE UPDATE ON profiles
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_matches_updated_at') THEN
    CREATE TRIGGER update_matches_updated_at
      BEFORE UPDATE ON matches
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END$$;

-- update_profile_stats_after_match: called when a match transitions to ended
CREATE OR REPLACE FUNCTION update_profile_stats_after_match()
RETURNS TRIGGER AS $$
BEGIN
  -- Only run when ended_at transitions from NULL -> NOT NULL
  IF TG_OP = 'UPDATE' AND OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL THEN

    -- Player X
    UPDATE profiles
      SET total_matches = total_matches + 1,
          total_wins = total_wins + CASE WHEN NEW.winner_user_id = NEW.player_x_user_id THEN 1 ELSE 0 END,
          total_losses = total_losses + CASE WHEN NEW.winner_user_id = NEW.player_o_user_id THEN 1 ELSE 0 END,
          total_draws = total_draws + CASE WHEN NEW.result = 'draw' THEN 1 ELSE 0 END,
          win_streak = CASE WHEN NEW.winner_user_id = NEW.player_x_user_id THEN win_streak + 1 ELSE 0 END,
          best_win_streak = CASE WHEN NEW.winner_user_id = NEW.player_x_user_id AND win_streak + 1 > best_win_streak THEN win_streak + 1 ELSE best_win_streak END,
          mindpoint = mindpoint + COALESCE(NEW.player_x_mindpoint_change, 0)
    WHERE user_id = NEW.player_x_user_id;

    -- Player O (if present)
    IF NEW.player_o_user_id IS NOT NULL THEN
      UPDATE profiles
        SET total_matches = total_matches + 1,
            total_wins = total_wins + CASE WHEN NEW.winner_user_id = NEW.player_o_user_id THEN 1 ELSE 0 END,
            total_losses = total_losses + CASE WHEN NEW.winner_user_id = NEW.player_x_user_id THEN 1 ELSE 0 END,
            total_draws = total_draws + CASE WHEN NEW.result = 'draw' THEN 1 ELSE 0 END,
            win_streak = CASE WHEN NEW.winner_user_id = NEW.player_o_user_id THEN win_streak + 1 ELSE 0 END,
            best_win_streak = CASE WHEN NEW.winner_user_id = NEW.player_o_user_id AND win_streak + 1 > best_win_streak THEN win_streak + 1 ELSE best_win_streak END,
            mindpoint = mindpoint + COALESCE(NEW.player_o_mindpoint_change, 0)
      WHERE user_id = NEW.player_o_user_id;
    END IF;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on matches AFTER UPDATE
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_profile_stats') THEN
    CREATE TRIGGER trigger_update_profile_stats
      AFTER UPDATE ON matches
      FOR EACH ROW
      WHEN (OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL)
      EXECUTE FUNCTION update_profile_stats_after_match();
  END IF;
END$$;

-- =====================================================================
-- RLS (Row Level Security) - basic, opinionated defaults for MVP
-- =====================================================================
-- Profiles: allow public SELECT (for leaderboards), but restrict updates/inserts to owner or service role.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Public read-only (select) for profiles (use views to hide sensitive fields if needed)
CREATE POLICY if_not_exists_profiles_select ON profiles
  FOR SELECT
  USING (true);

-- Allow authenticated users to insert their profile only if auth.uid() matches user_id
CREATE POLICY if_not_exists_profiles_insert ON profiles
  FOR INSERT
  WITH CHECK (auth.uid()::uuid = user_id);

-- Allow users to update their own profile
CREATE POLICY if_not_exists_profiles_update ON profiles
  FOR UPDATE
  USING (auth.uid()::uuid = user_id)
  WITH CHECK (auth.uid()::uuid = user_id);

-- Rooms: basic policies
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- Allow public select on rooms (or create a limited view)
CREATE POLICY if_not_exists_rooms_select ON rooms FOR SELECT USING (true);

-- Allow room owner to update/delete
CREATE POLICY if_not_exists_rooms_update ON rooms
  FOR UPDATE
  USING (auth.uid()::uuid = owner_user_id)
  WITH CHECK (auth.uid()::uuid = owner_user_id);

-- Moves: only allow inserting moves by the player and only if match not ended
ALTER TABLE moves ENABLE ROW LEVEL SECURITY;
CREATE POLICY if_not_exists_moves_insert ON moves
  FOR INSERT
  WITH CHECK (
    auth.uid()::uuid = player_user_id
    AND (SELECT ended_at IS NULL FROM matches WHERE id = match_id)
  );

-- Chat messages: allow insert if sender is auth user; SELECT allowed publicly for now
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY if_not_exists_chat_insert ON chat_messages
  FOR INSERT
  WITH CHECK (auth.uid()::uuid = sender_user_id);

-- Transactions & other financial tables: enable RLS and restrict to owner (omitted for brevity)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY if_not_exists_transactions_select ON transactions FOR SELECT USING (auth.uid()::uuid = user_id);
CREATE POLICY if_not_exists_transactions_insert ON transactions FOR INSERT WITH CHECK (auth.uid()::uuid = user_id);

-- Notes:
-- - Admin/service operations should use the Supabase service_role key (server side) to bypass RLS
-- - For more advanced per-match policies (e.g. ensure a chat sender is part of a room), consider creating helper SQL functions to check membership and use them in USING/WITH CHECK expressions.

-- =====================================================================
-- SAFE SEED DATA (achievements, items)
-- =====================================================================
-- Achievements
INSERT INTO achievements (achievement_code, name, description, category, requirement_type, requirement_value, reward_coins)
VALUES
('first_win', 'Chiến thắng đầu tiên', 'Giành chiến thắng trong trận đấu đầu tiên', 'wins', 'win_count', 1, 100),
('win_10', 'Kỳ Thủ Sơ Khai', 'Giành 10 chiến thắng', 'wins', 'win_count', 10, 500),
('win_50', 'Kỳ Thủ Lão Luyện', 'Giành 50 chiến thắng', 'wins', 'win_count', 50, 2000),
('win_100', 'Kỳ Thánh', 'Giành 100 chiến thắng', 'wins', 'win_count', 100, 5000),
('streak_5', 'Liên Thắng 5', 'Giành 5 chiến thắng liên tiếp', 'streak', 'win_streak', 5, 300),
('streak_10', 'Bất Bại', 'Giành 10 chiến thắng liên tiếp', 'streak', 'win_streak', 10, 1000)
ON CONFLICT (achievement_code) DO NOTHING;

-- Items
INSERT INTO items (item_code, name, description, category, price_coins, rarity)
VALUES
('skin_classic_wood', 'Quân Cờ Gỗ Cổ Điển', 'Quân cờ gỗ truyền thống', 'skin_piece', 0, 'common'),
('skin_jade_pieces', 'Quân Cờ Ngọc Bích', 'Quân cờ làm từ ngọc bích quý giá', 'skin_piece', 5000, 'epic'),
('board_bamboo', 'Bàn Cờ Tre', 'Bàn cờ tre xanh thanh lịch', 'skin_board', 2000, 'rare'),
('board_marble', 'Bàn Cờ Đá Cẩm Thạch', 'Bàn cờ đá cẩm thạch cao cấp', 'skin_board', 10000, 'legendary')
ON CONFLICT (item_code) DO NOTHING;

-- =====================================================================
-- FINAL NOTES
-- =====================================================================
-- 1) This file is intentionally focused on core MVP tables and policies. The original full schema contains many more tables (tournaments, reports, admin_logs, ai_analysis, notifications, etc.). Add them as needed.
-- 2) Migration steps we recommend:
--    a) Apply this SQL to Supabase.
--    b) Configure your backend to verify Supabase JWTs and, on first login, create/ensure a `profiles` row with `user_id = auth.users.id`.
--    c) Use service_role key on server-side jobs (seeding, admin actions, cross-table updates where RLS would block).
-- 3) UUID strategy: this schema uses `pgcrypto`/`gen_random_uuid()`; if you prefer `uuid-ossp`, add that extension and change defaults.

-- End of file
