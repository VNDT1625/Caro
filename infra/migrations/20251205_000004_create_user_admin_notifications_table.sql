-- Create user_admin_notifications table for tracking admin notification delivery and read status
-- Migration: 20251205_000004_create_user_admin_notifications_table.sql
-- NOTE: References profiles.user_id (not profiles.id)

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

-- Index for user's inbox queries
CREATE INDEX IF NOT EXISTS idx_user_admin_notifications_user_id ON user_admin_notifications(user_id);

-- Index for unread notifications count
CREATE INDEX IF NOT EXISTS idx_user_admin_notifications_unread ON user_admin_notifications(user_id, is_read) 
    WHERE deleted_at IS NULL;

-- Index for notification read stats
CREATE INDEX IF NOT EXISTS idx_user_admin_notifications_notification_id ON user_admin_notifications(notification_id);

-- Index for sorting by created_at
CREATE INDEX IF NOT EXISTS idx_user_admin_notifications_created_at ON user_admin_notifications(user_id, created_at DESC) 
    WHERE deleted_at IS NULL;

-- RLS Policies
ALTER TABLE user_admin_notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own admin notifications" ON user_admin_notifications
    FOR SELECT
    USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read, delete)
CREATE POLICY "Users can update own admin notifications" ON user_admin_notifications
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Admins can insert notifications for users
CREATE POLICY "Admins can create user admin notifications" ON user_admin_notifications
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM admin 
            WHERE admin.user_id = auth.uid() 
            AND admin.is_active = true
        )
    );

-- Admins can view all user_admin_notifications for their notifications
CREATE POLICY "Admins can view admin notification stats" ON user_admin_notifications
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM admin_notifications 
            WHERE admin_notifications.id = user_admin_notifications.notification_id 
            AND admin_notifications.admin_id = auth.uid()
        )
    );

-- Admins can delete user_admin_notifications for their notifications
CREATE POLICY "Admins can delete user admin notifications" ON user_admin_notifications
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM admin_notifications 
            WHERE admin_notifications.id = user_admin_notifications.notification_id 
            AND admin_notifications.admin_id = auth.uid()
        )
    );
