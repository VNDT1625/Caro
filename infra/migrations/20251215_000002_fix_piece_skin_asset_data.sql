-- Migration: Fix piece_skin items asset_data
-- Date: 2024-12-15
-- Description: Update existing piece_skin items to have asset_data with stone URLs from preview_url

-- Update piece_skin items that have preview_url but no asset_data.stone
UPDATE public.items 
SET asset_data = jsonb_build_object(
  'stone', preview_url,
  'black_stone', preview_url,
  'white_stone', preview_url
)
WHERE category = 'piece_skin' 
  AND preview_url IS NOT NULL 
  AND preview_url != ''
  AND (
    asset_data IS NULL 
    OR asset_data->>'stone' IS NULL
    OR asset_data->>'stone' = ''
  );

-- Also update items with category containing 'piece' (case insensitive)
UPDATE public.items 
SET asset_data = jsonb_build_object(
  'stone', preview_url,
  'black_stone', preview_url,
  'white_stone', preview_url
)
WHERE LOWER(category) LIKE '%piece%'
  AND preview_url IS NOT NULL 
  AND preview_url != ''
  AND (
    asset_data IS NULL 
    OR asset_data->>'stone' IS NULL
    OR asset_data->>'stone' = ''
  );

-- Verify the update
SELECT id, item_code, name, category, preview_url, asset_data 
FROM public.items 
WHERE LOWER(category) LIKE '%piece%' OR category = 'piece_skin';
