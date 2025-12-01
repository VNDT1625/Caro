-- Migration: Add chat_messages, room_invitations tables
-- Description: Complete social features for room creation and in-game chat
-- Date: 2025-11-30

-- =====================================================================
-- CHAT MESSAGES TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'emoji', 'system')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for chat performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);

-- Enable RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view messages in rooms they're part of
DROP POLICY IF EXISTS "Users can view room messages" ON chat_messages;
CREATE POLICY "Users can view room messages" ON chat_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM room_players
            WHERE room_players.room_id = chat_messages.room_id
            AND room_players.user_id = auth.uid()
        )
    );

-- Policy: Users can send messages to rooms they're in
DROP POLICY IF EXISTS "Users can send messages" ON chat_messages;
CREATE POLICY "Users can send messages" ON chat_messages
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM room_players
            WHERE room_players.room_id = chat_messages.room_id
            AND room_players.user_id = auth.uid()
        )
    );

COMMENT ON TABLE chat_messages IS 'In-game chat messages';
COMMENT ON COLUMN chat_messages.message_type IS 'Message type: text, emoji, or system announcement';

-- =====================================================================
-- ROOM INVITATIONS TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS room_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    inviter_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    invitee_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '5 minutes'),
    
    UNIQUE(room_id, invitee_id),
    CHECK (inviter_id != invitee_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_room_invitations_invitee ON room_invitations(invitee_id, status);
CREATE INDEX IF NOT EXISTS idx_room_invitations_room ON room_invitations(room_id);
CREATE INDEX IF NOT EXISTS idx_room_invitations_expires ON room_invitations(expires_at) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE room_invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view invitations sent to them or by them
DROP POLICY IF EXISTS "Users can view own invitations" ON room_invitations;
CREATE POLICY "Users can view own invitations" ON room_invitations
    FOR SELECT
    USING (auth.uid() = invitee_id OR auth.uid() = inviter_id);

-- Policy: Users can create invitations for rooms they host
DROP POLICY IF EXISTS "Users can create invitations" ON room_invitations;
CREATE POLICY "Users can create invitations" ON room_invitations
    FOR INSERT
    WITH CHECK (
        auth.uid() = inviter_id
        AND EXISTS (
            SELECT 1 FROM rooms
            WHERE rooms.id = room_invitations.room_id
            AND rooms.host_id = auth.uid()
        )
    );

-- Policy: Invitees can update their invitations
DROP POLICY IF EXISTS "Users can respond to invitations" ON room_invitations;
CREATE POLICY "Users can respond to invitations" ON room_invitations
    FOR UPDATE
    USING (auth.uid() = invitee_id)
    WITH CHECK (auth.uid() = invitee_id);

COMMENT ON TABLE room_invitations IS 'Room invitations to friends';
COMMENT ON COLUMN room_invitations.expires_at IS 'Invitation expires after 5 minutes';

-- =====================================================================
-- FRIEND REQUESTS (if not exists from previous migration)
-- =====================================================================
CREATE TABLE IF NOT EXISTS friend_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(sender_id, receiver_id),
    CHECK (sender_id != receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON friend_requests(sender_id);

-- Enable RLS
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own friend requests" ON friend_requests;
CREATE POLICY "Users can view own friend requests" ON friend_requests
    FOR SELECT
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can send friend requests" ON friend_requests;
CREATE POLICY "Users can send friend requests" ON friend_requests
    FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can respond to requests" ON friend_requests;
CREATE POLICY "Users can respond to requests" ON friend_requests
    FOR UPDATE
    USING (auth.uid() = receiver_id)
    WITH CHECK (auth.uid() = receiver_id);

COMMENT ON TABLE friend_requests IS 'Friend request system';

-- =====================================================================
-- BLOCKED USERS TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS blocked_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    UNIQUE(blocker_id, blocked_id),
    CHECK (blocker_id != blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON blocked_users(blocked_id);

-- Enable RLS
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own blocks" ON blocked_users;
CREATE POLICY "Users can view own blocks" ON blocked_users
    FOR SELECT
    USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users can block others" ON blocked_users;
CREATE POLICY "Users can block others" ON blocked_users
    FOR INSERT
    WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users can unblock" ON blocked_users;
CREATE POLICY "Users can unblock" ON blocked_users
    FOR DELETE
    USING (auth.uid() = blocker_id);

COMMENT ON TABLE blocked_users IS 'User blocking system - prevents matchmaking and interactions';

-- =====================================================================
-- ENABLE REALTIME FOR NEW TABLES
-- =====================================================================
-- Run these in Supabase Dashboard -> Database -> Replication
-- ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE room_invitations;
-- ALTER PUBLICATION supabase_realtime ADD TABLE friend_requests;

-- =====================================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Note: This migration completes the social features infrastructure
-- Remember to enable Realtime in Supabase Dashboard for real-time chat
