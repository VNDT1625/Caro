-- Create admin_notifications table for admin-to-user messaging
-- Migration: 20251205_000003_create_admin_notifications_table.sql
-- NOTE: Uses existing 'admin' table for admin verification

CREATE TABLE IF NOT EXISTS admin_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES admin(user_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_broadcast BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

-- Index for admin's sent notifications
CREATE INDEX IF NOT EXISTS idx_admin_notifications_admin_id ON admin_notifications(admin_id);

-- Index for listing active notifications
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications(created_at DESC) WHERE deleted_at IS NULL;

-- RLS Policies
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Admins can insert notifications
CREATE POLICY "Admins can create admin notifications" ON admin_notifications
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM admin 
            WHERE admin.user_id = auth.uid() 
            AND admin.is_active = true
        )
    );

-- Admins can view their own notifications, users can view notifications sent to them
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

-- Admins can update/delete their own notifications
CREATE POLICY "Admins can manage own admin notifications" ON admin_notifications
    FOR UPDATE
    USING (admin_id = auth.uid())
    WITH CHECK (admin_id = auth.uid());

CREATE POLICY "Admins can delete own admin notifications" ON admin_notifications
    FOR DELETE
    USING (admin_id = auth.uid());
