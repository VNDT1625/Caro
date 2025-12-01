-- Add target_user_id to support 1-1 friends chat
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS target_user_id uuid;

ALTER TABLE chat_messages
  ADD CONSTRAINT chat_messages_target_user_id_fkey
  FOREIGN KEY (target_user_id) REFERENCES public.profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_target_pair
  ON chat_messages (channel_scope, sender_user_id, target_user_id, created_at DESC);
