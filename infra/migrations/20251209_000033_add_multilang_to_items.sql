-- Migration: Add multi-language support to items table
-- Date: 2024-12-09
-- Professional approach: Store translations in database, not i18n files

-- Add columns for Chinese and Japanese names/descriptions
ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS name_zh text,
ADD COLUMN IF NOT EXISTS name_ja text,
ADD COLUMN IF NOT EXISTS description_zh text,
ADD COLUMN IF NOT EXISTS description_ja text;

-- Comment for documentation
COMMENT ON COLUMN public.items.name IS 'Vietnamese name (default)';
COMMENT ON COLUMN public.items.name_en IS 'English name';
COMMENT ON COLUMN public.items.name_zh IS 'Chinese name';
COMMENT ON COLUMN public.items.name_ja IS 'Japanese name';
COMMENT ON COLUMN public.items.description IS 'Vietnamese description (default)';
COMMENT ON COLUMN public.items.description_en IS 'English description';
COMMENT ON COLUMN public.items.description_zh IS 'Chinese description';
COMMENT ON COLUMN public.items.description_ja IS 'Japanese description';

-- Also add to categories table for consistency
ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS name_zh text,
ADD COLUMN IF NOT EXISTS name_ja text;
