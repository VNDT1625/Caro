-- Migration: Add Chinese and Japanese translations for categories and items
-- Date: 2025-11-30
-- Description: Extends categories and items tables with name_zh, name_ja, description_zh, description_ja columns

-- Add Chinese and Japanese columns to categories table
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS name_zh text,
ADD COLUMN IF NOT EXISTS name_ja text;

COMMENT ON COLUMN categories.name_zh IS 'Category name in Chinese (中文)';
COMMENT ON COLUMN categories.name_ja IS 'Category name in Japanese (日本語)';

-- Add Chinese and Japanese columns to items table
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS name_zh text,
ADD COLUMN IF NOT EXISTS name_ja text,
ADD COLUMN IF NOT EXISTS description_zh text,
ADD COLUMN IF NOT EXISTS description_ja text;

COMMENT ON COLUMN items.name_zh IS 'Item name in Chinese (中文)';
COMMENT ON COLUMN items.name_ja IS 'Item name in Japanese (日本語)';
COMMENT ON COLUMN items.description_zh IS 'Item description in Chinese (中文)';
COMMENT ON COLUMN items.description_ja IS 'Item description in Japanese (日本語)';

-- Update sample data with Chinese and Japanese translations
-- Categories
UPDATE categories SET 
  name_zh = '棋子皮肤',
  name_ja = 'ピーススキン'
WHERE id = 'piece_skin';

UPDATE categories SET 
  name_zh = '棋盘皮肤',
  name_ja = 'ボードスキン'
WHERE id = 'board_skin';

UPDATE categories SET 
  name_zh = '头像框',
  name_ja = 'アバターフレーム'
WHERE id = 'avatar_frame';

UPDATE categories SET 
  name_zh = '表情',
  name_ja = 'エモート'
WHERE id = 'emote';

-- Items (sample item - "Quân Cờ Gỗ Cổ Điển")
UPDATE items SET 
  name_zh = '经典木制棋子',
  name_ja = 'クラシック木製ピース',
  description_zh = '传统木制棋子，经典而优雅的设计',
  description_ja = '伝統的な木製ピース、クラシックでエレガントなデザイン'
WHERE name = 'Quân Cờ Gỗ Cổ Điển';

-- Note: Add more translations as needed for other items
-- You can use the following template:
/*
UPDATE items SET 
  name_zh = 'Chinese name',
  name_ja = 'Japanese name',
  description_zh = 'Chinese description',
  description_ja = 'Japanese description'
WHERE name = 'Vietnamese name';
*/
