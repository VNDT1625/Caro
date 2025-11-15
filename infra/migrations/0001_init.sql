-- Migration 0001: initial supabase schema (copied from supabase_schema.sql)
-- This file is suitable for `supabase db push` as a single migration.

-- =====================================================================
-- MINDPOINT ARENA - COMPLETE OPTIMIZED DATABASE SCHEMA (FIXED)
-- Supabase-ready schema with enhanced constraints and audit support
-- Version: 2.0.3 (All dollar-quote syntax fixed)
-- =====================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================================
-- PART 1: CORE TABLES
-- =====================================================================

-- =====================================================================
-- 1) PROFILES (link to Supabase Auth)
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

  -- currency
  coins INTEGER DEFAULT 0,
  gems INTEGER DEFAULT 0,

  -- equipped items
  equipped_board_skin UUID,
  equipped_piece_skin UUID,
  
  -- audit fields
  last_active TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- Enhanced constraints
  CONSTRAINT check_non_negative_currency CHECK (coins >= 0 AND gems >= 0),
  CONSTRAINT check_non_negative_stats CHECK (
    total_matches >= 0 AND total_wins >= 0 AND 
    total_losses >= 0 AND total_draws >= 0 AND
    win_streak >= 0 AND best_win_streak >= 0
  ),
  CONSTRAINT check_valid_rank CHECK (current_rank IN (
    'vo_danh', 'tan_ky', 'hoc_ky', 'ky_lao', 'cao_ky', 'ky_thanh', 'truyen_thuyet'
  )),
  CONSTRAINT check_elo_range CHECK (elo_rating >= 0 AND elo_rating <= 5000),
  CONSTRAINT check_username_format CHECK (username ~ '^[a-zA-Z0-9_]{3,50}$')
);

CREATE INDEX IF NOT EXISTS idx_profiles_userid ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_mindpoint ON profiles(mindpoint DESC, elo_rating DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON profiles(display_name);
CREATE INDEX IF NOT EXISTS idx_profiles_rank ON profiles(current_rank);

COMMENT ON TABLE profiles IS 'Thông tin người chơi với enhanced constraints';
COMMENT ON COLUMN profiles.current_rank IS 'Rank: vo_danh | tan_ky | hoc_ky | ky_lao | cao_ky | ky_thanh | truyen_thuyet';

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

  status VARCHAR(20) DEFAULT 'waiting',
  current_players INTEGER DEFAULT 1,

  game_config JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,

  -- Enhanced constraints
  CONSTRAINT check_room_status_valid CHECK (status IN ('waiting', 'playing', 'finished')),
  CONSTRAINT check_room_mode_valid CHECK (mode IN ('casual', 'ranked', 'tournament', 'friend')),
  CONSTRAINT check_max_players_range CHECK (max_players >= 2 AND max_players <= 10),
  CONSTRAINT check_board_size_range CHECK (board_size >= 10 AND board_size <= 25),
  CONSTRAINT check_win_length_range CHECK (win_length >= 3 AND win_length <= 10),
  CONSTRAINT check_current_players_valid CHECK (current_players >= 0 AND current_players <= max_players)
);

CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status, is_private);
CREATE INDEX IF NOT EXISTS idx_rooms_owner ON rooms(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(room_code) WHERE room_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rooms_mode ON rooms(mode, status);

COMMENT ON TABLE rooms IS 'Phòng chơi với validated constraints';

-- (file truncated here; full schema is copied from infra/supabase_schema.sql)
