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
