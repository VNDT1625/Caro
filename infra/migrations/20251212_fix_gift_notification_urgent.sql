-- URGENT FIX: Add gift_data column to admin_notifications
-- Run this in Supabase SQL Editor if gift notifications are not working

-- Step 1: Check if column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'admin_notifications' AND column_name = 'gift_data'
    ) THEN
        -- Add gift_data column
        ALTER TABLE admin_notifications ADD COLUMN gift_data JSONB DEFAULT NULL;
        RAISE NOTICE 'Added gift_data column to admin_notifications';
    ELSE
        RAISE NOTICE 'gift_data column already exists';
    END IF;
END $$;

-- Step 2: Check if gift_claimed columns exist in user_admin_notifications
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_admin_notifications' AND column_name = 'gift_claimed'
    ) THEN
        ALTER TABLE user_admin_notifications ADD COLUMN gift_claimed BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added gift_claimed column';
    ELSE
        RAISE NOTICE 'gift_claimed column already exists';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_admin_notifications' AND column_name = 'gift_claimed_at'
    ) THEN
        ALTER TABLE user_admin_notifications ADD COLUMN gift_claimed_at TIMESTAMPTZ NULL;
        RAISE NOTICE 'Added gift_claimed_at column';
    ELSE
        RAISE NOTICE 'gift_claimed_at column already exists';
    END IF;
END $$;

-- Step 3: Verify columns exist
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'admin_notifications' 
AND column_name = 'gift_data';

SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_admin_notifications' 
AND column_name IN ('gift_claimed', 'gift_claimed_at');

-- Step 4: Check existing notifications
SELECT id, title, gift_data, created_at 
FROM admin_notifications 
ORDER BY created_at DESC 
LIMIT 5;
