-- Migration: Add preferred_settings column to existing matchmaking_queue table
-- Description: Adds missing preferred_settings JSONB column
-- Date: 2025-11-17

-- Check if column exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'matchmaking_queue' 
        AND column_name = 'preferred_settings'
    ) THEN
        ALTER TABLE matchmaking_queue 
        ADD COLUMN preferred_settings JSONB NOT NULL DEFAULT '{}'::jsonb;
        
        RAISE NOTICE 'Column preferred_settings added successfully';
    ELSE
        RAISE NOTICE 'Column preferred_settings already exists';
    END IF;
END $$;

-- Add comment
COMMENT ON COLUMN matchmaking_queue.preferred_settings IS 'Game settings preferences (board_size, turn_time, etc)';
