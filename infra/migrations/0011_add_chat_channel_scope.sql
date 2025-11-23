ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS channel_scope VARCHAR(20) DEFAULT 'global';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_channel_scope_valid'
      AND conrelid = 'chat_messages'::regclass
  ) THEN
    ALTER TABLE chat_messages
      ADD CONSTRAINT check_channel_scope_valid
      CHECK (channel_scope IN ('global', 'friends', 'room', 'match'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chat_channel_scope
  ON chat_messages(channel_scope, created_at DESC);
