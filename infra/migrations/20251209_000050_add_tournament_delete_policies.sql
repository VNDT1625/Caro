-- Migration: Add DELETE policies for tournaments
-- Date: 2024-12-09

-- Creator can delete their tournaments (only if no participants)
CREATE POLICY "Creator can delete their tournaments"
  ON public.tournaments FOR DELETE
  TO authenticated
  USING (creator_user_id = auth.uid() AND current_players = 0);

-- Users can delete their own participation (leave tournament)
CREATE POLICY "Users can leave tournaments"
  ON public.tournament_participants FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
