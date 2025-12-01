-- Migration: Add multi-language support for items
-- Date: 2025-11-30

-- Add English name and description fields to items table
ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS name_en text,
ADD COLUMN IF NOT EXISTS description_en text;

-- Update existing items with English translations
-- Classic Wooden Piece
UPDATE public.items 
SET 
  name_en = 'Classic Wooden Piece',
  description_en = 'Traditional wooden chess piece, free for everyone'
WHERE name = 'Quân Cờ Gỗ Cổ Điển';

-- Add comments
COMMENT ON COLUMN public.items.name_en IS 'English name of the item';
COMMENT ON COLUMN public.items.description_en IS 'English description of the item';
