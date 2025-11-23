-- Enable realtime for room_players table
-- This allows both players to receive UPDATE notifications

-- Set replica identity to FULL so UPDATE events include old and new data
ALTER TABLE room_players REPLICA IDENTITY FULL;

-- Table is already in supabase_realtime publication, no need to add again

