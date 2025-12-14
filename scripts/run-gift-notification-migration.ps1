# Script to run gift notification migration
# Run this in PowerShell

Write-Host "=== Gift Notification Migration ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "This migration adds gift support to admin notifications." -ForegroundColor Yellow
Write-Host "Supports: coins, gems, and items from items table" -ForegroundColor Yellow
Write-Host ""
Write-Host "Please run the following SQL in Supabase SQL Editor:" -ForegroundColor Green
Write-Host ""

$sql = @"
-- Add gift support to admin notifications
-- Migration: 20251209_000050_add_gift_to_admin_notifications.sql

-- Add gift_data column to admin_notifications
-- gift_data format: { "coins": 100, "gems": 10, "item_ids": ["uuid1", "uuid2"] }
-- item_ids references items.id (UUID) from items table
ALTER TABLE admin_notifications 
ADD COLUMN IF NOT EXISTS gift_data JSONB DEFAULT NULL;

-- Add gift_claimed column to user_admin_notifications to track if user claimed the gift
ALTER TABLE user_admin_notifications 
ADD COLUMN IF NOT EXISTS gift_claimed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS gift_claimed_at TIMESTAMPTZ NULL;

-- Index for finding unclaimed gifts
CREATE INDEX IF NOT EXISTS idx_user_admin_notifications_gift_unclaimed 
ON user_admin_notifications(user_id, gift_claimed) 
WHERE deleted_at IS NULL AND gift_claimed = FALSE;

-- Comment for documentation
COMMENT ON COLUMN admin_notifications.gift_data IS 'JSON: {coins: number, gems: number, item_ids: uuid[]} - item_ids references items.id';
COMMENT ON COLUMN user_admin_notifications.gift_claimed IS 'Whether user has claimed the gift attached to this notification';
COMMENT ON COLUMN user_admin_notifications.gift_claimed_at IS 'Timestamp when user claimed the gift';
"@

Write-Host $sql -ForegroundColor White
Write-Host ""
Write-Host "=== Steps ===" -ForegroundColor Cyan
Write-Host "1. Go to Supabase Dashboard > SQL Editor"
Write-Host "2. Paste the SQL above"
Write-Host "3. Click 'Run'"
Write-Host "4. Verify columns were added:"
Write-Host "   SELECT column_name FROM information_schema.columns WHERE table_name = 'admin_notifications';"
Write-Host ""
Write-Host "=== Gift Data Format ===" -ForegroundColor Cyan
Write-Host "gift_data: {"
Write-Host "  coins: number (0-100000),"
Write-Host "  gems: number (0-10000),"
Write-Host "  item_ids: string[] (UUIDs from items table)"
Write-Host "}"
Write-Host ""
Write-Host "After running, the gift notification feature will work!" -ForegroundColor Green
