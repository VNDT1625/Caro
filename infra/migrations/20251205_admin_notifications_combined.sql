-- Combined migration for Admin Notification System
-- Run this in Supabase SQL Editor
-- Migration: 20251205_admin_notifications_combined.sql

-- ============================================
-- STEP 1: Create tables first (no cross-references)
-- ============================================

-- 1a. Create admin_notifications table
CREATE TABLE IF NOT EXISTS admin_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES admin(user_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_broadcast BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

-- 1b. Create user_admin_notifications table
CREATE TABLE IF NOT EXISTS user_admin_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES admin_notifications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ NULL,
    deleted_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(notification_id, user_id)
);

-- ============================================
-- STEP 2: Create indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_admin_notifications_admin_id ON admin_notifications(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications(created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_admin_notifications_user_id ON user_admin_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_admin_notifications_unread ON user_admin_notifications(user_id, is_read) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_admin_notifications_notification_id ON user_admin_notifications(notification_id);
CREATE INDEX IF NOT EXISTS idx_user_admin_notifications_created_at ON user_admin_notifications(user_id, created_at DESC) WHERE deleted_at IS NULL;

-- ============================================
-- STEP 3: Enable RLS
-- ============================================
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_admin_notifications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 4: Create policies for admin_notifications
-- ============================================
CREATE POLICY "Admins can create admin notifications" ON admin_notifications
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM admin 
            WHERE admin.user_id = auth.uid() 
            AND admin.is_active = true
        )
    );

CREATE POLICY "View admin notifications" ON admin_notifications
    FOR SELECT
    USING (
        admin_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM user_admin_notifications 
            WHERE user_admin_notifications.notification_id = admin_notifications.id 
            AND user_admin_notifications.user_id = auth.uid()
            AND user_admin_notifications.deleted_at IS NULL
        )
    );

CREATE POLICY "Admins can manage own admin notifications" ON admin_notifications
    FOR UPDATE
    USING (admin_id = auth.uid())
    WITH CHECK (admin_id = auth.uid());

CREATE POLICY "Admins can delete own admin notifications" ON admin_notifications
    FOR DELETE
    USING (admin_id = auth.uid());

-- ============================================
-- STEP 5: Create policies for user_admin_notifications
-- ============================================
CREATE POLICY "Users can view own admin notifications" ON user_admin_notifications
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can update own admin notifications" ON user_admin_notifications
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can create user admin notifications" ON user_admin_notifications
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM admin 
            WHERE admin.user_id = auth.uid() 
            AND admin.is_active = true
        )
    );

CREATE POLICY "Admins can view admin notification stats" ON user_admin_notifications
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM admin_notifications 
            WHERE admin_notifications.id = user_admin_notifications.notification_id 
            AND admin_notifications.admin_id = auth.uid()
        )
    );

CREATE POLICY "Admins can delete user admin notifications" ON user_admin_notifications
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM admin_notifications 
            WHERE admin_notifications.id = user_admin_notifications.notification_id 
            AND admin_notifications.admin_id = auth.uid()
        )
    );

-- ============================================
-- Done! Run this entire script in Supabase SQL Editor
-- ============================================
