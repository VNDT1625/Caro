-- Create a helper function to atomically match two queue entries
-- This function uses SELECT FOR UPDATE to lock rows and prevent race conditions
-- Run this in Supabase SQL Editor or via migration runner

CREATE OR REPLACE FUNCTION public.match_players(
  a uuid,
  b uuid,
  a_user uuid,
  b_user uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  affected_count integer;
BEGIN
  -- CRITICAL: Use SELECT FOR UPDATE to lock rows before checking status
  -- This prevents multiple transactions from matching the same player
  PERFORM id FROM matchmaking_queue
  WHERE id = ANY(ARRAY[a, b])
  AND status = 'waiting'
  FOR UPDATE SKIP LOCKED; -- Skip if already locked by another transaction
  
  -- Check if both rows are still available (not locked/matched by another transaction)
  SELECT COUNT(*) INTO affected_count
  FROM matchmaking_queue
  WHERE id = ANY(ARRAY[a, b])
  AND status = 'waiting';
  
  -- If both players are still waiting, update them
  IF affected_count = 2 THEN
    UPDATE matchmaking_queue
    SET status = 'matched',
        matched_at = now(),
        matched_with = CASE
          WHEN id = a THEN b_user
          WHEN id = b THEN a_user
        END
    WHERE id = ANY(ARRAY[a, b]);
    
    RETURN true; -- Success
  ELSE
    RETURN false; -- One or both players already matched
  END IF;
END;
$$;

-- Grant execute to authenticated role if needed
-- GRANT EXECUTE ON FUNCTION public.match_players(uuid, uuid, uuid, uuid) TO authenticated;
