# Database Schema (Supabase)

## Core Tables

### profiles
```sql
profiles (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES auth.users(id),
  username VARCHAR(50),
  display_name VARCHAR(100),
  avatar_url TEXT,
  current_rank VARCHAR(50) DEFAULT 'vo_danh',
  mindpoint INTEGER DEFAULT 0,
  elo_rating INTEGER DEFAULT 1000,
  coins INTEGER DEFAULT 0,
  gems INTEGER DEFAULT 0,
  equipped_board_skin UUID,
  equipped_piece_skin UUID,
  equipped_avatar_frame UUID,
  total_matches INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  settings JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

### matches
```sql
matches (
  id UUID PRIMARY KEY,
  room_id UUID REFERENCES rooms(id),
  player_x_user_id UUID REFERENCES profiles(user_id),
  player_o_user_id UUID REFERENCES profiles(user_id),
  winner_user_id UUID,
  series_id UUID REFERENCES ranked_series(id),
  swap2_history JSONB,
  total_moves INTEGER,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
)
```

### ranked_series
```sql
ranked_series (
  id UUID PRIMARY KEY,
  player1_id UUID REFERENCES profiles(user_id),
  player2_id UUID REFERENCES profiles(user_id),
  player1_wins INTEGER DEFAULT 0,
  player2_wins INTEGER DEFAULT 0,
  current_game INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'in_progress',
  player1_initial_mp INTEGER,
  player2_initial_mp INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

## Skill System

```sql
skills (id, skill_code, name_vi, mana_cost, cooldown, effect_type, rarity)
user_skills (user_id, skill_id, quantity)
user_skill_combos (user_id, combo_name, skill_ids)
match_skill_state (match_id, state JSONB)
skill_packages (id, package_code, cards_count, common_rate, rare_rate, legendary_rate)
seasons (id, season_number, name, is_active)
```

## Economy

```sql
items (id, item_code, category, price_coins, price_gems, preview_url)
user_items (user_id, item_id, is_equipped)
currency_packages (id, currency_type, amount, price_vnd)
subscriptions (user_id, tier, expires_at)
usage_logs (user_id, feature, count)
analysis_cache (match_id, tier, result JSONB)
```

## Social

```sql
friends (user_id, friend_id, status)
chat_messages (sender_user_id, content, channel_scope, room_id)
reports (reporter_id, reported_user_id, type, status, ai_analysis)
appeals (report_id, user_id, reason, status, admin_response)
user_bans (user_id, reason, expires_at, is_permanent)
```

## Notifications

```sql
admin_notifications (id, admin_id, title, content, is_broadcast)
user_admin_notifications (user_id, notification_id, is_read, gift_claimed)
```

## Migrations

Located in `infra/migrations/`. Key migrations:
- `0001_init.sql` - Initial schema
- `20251203_000004_create_ranked_series.sql` - Ranked Bo3
- `20251206_000002_create_skills_table.sql` - Skill system
- `20251209_000001_create_titles_system.sql` - Titles

## RLS Policies

All tables have Row Level Security enabled:
- Users can only read/write their own data
- Admin users have elevated access
- Public data (leaderboards, shop items) readable by all

## Realtime

Tables enabled for Supabase Realtime:
- `ranked_series` - Series updates
- `room_players` - Room presence
- `chat_messages` - Real-time chat
