-- Migration: Create match_skill_logs table for tracking skill usage in matches
-- Date: 2025-12-06

CREATE TABLE IF NOT EXISTS public.match_skill_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  
  -- Turn info
  turn_number integer NOT NULL CHECK (turn_number > 0),
  
  -- Skill options offered
  offered_skills jsonb NOT NULL, -- array of 3 skill_ids
  
  -- Player choice
  selected_skill_id uuid REFERENCES public.skills(id), -- null if skipped
  was_skipped boolean DEFAULT false,
  
  -- Target (for targeted skills)
  target_position jsonb, -- { "x": 7, "y": 7 }
  
  -- Effect result
  effect_result jsonb, -- { "success": true, "changes": [...] }
  board_state_before jsonb,
  board_state_after jsonb,
  
  -- Timing
  selection_time_ms integer, -- how long player took to decide
  
  created_at timestamp with time zone DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_match_skill_logs_match ON public.match_skill_logs(match_id);
CREATE INDEX IF NOT EXISTS idx_match_skill_logs_user ON public.match_skill_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_match_skill_logs_skill ON public.match_skill_logs(selected_skill_id) WHERE selected_skill_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_match_skill_logs_turn ON public.match_skill_logs(match_id, turn_number);

-- RLS Policies
ALTER TABLE public.match_skill_logs ENABLE ROW LEVEL SECURITY;

-- Users can read logs from matches they participated in
CREATE POLICY "match_skill_logs_select_participant" ON public.match_skill_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (m.player_x_user_id = auth.uid() OR m.player_o_user_id = auth.uid())
    )
  );

-- System can insert (via service role)
CREATE POLICY "match_skill_logs_insert_system" ON public.match_skill_logs
  FOR INSERT WITH CHECK (true);

-- Admins can do everything
CREATE POLICY "match_skill_logs_admin_all" ON public.match_skill_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admin WHERE user_id = auth.uid() AND is_active = true)
  );

-- Function to update user_skills usage stats
CREATE OR REPLACE FUNCTION update_skill_usage_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.selected_skill_id IS NOT NULL THEN
    UPDATE public.user_skills
    SET times_used = times_used + 1,
        updated_at = now()
    WHERE user_id = NEW.user_id
      AND skill_id = NEW.selected_skill_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER match_skill_logs_update_stats
  AFTER INSERT ON public.match_skill_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_skill_usage_stats();

COMMENT ON TABLE public.match_skill_logs IS 'Logs all skill offerings and usage during matches';
