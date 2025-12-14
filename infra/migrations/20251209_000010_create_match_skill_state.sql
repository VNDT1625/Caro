-- Create table to persist skill state per match (Postgres)
CREATE TABLE IF NOT EXISTS public.match_skill_state (
  match_id uuid PRIMARY KEY,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_skill_state_updated_at ON public.match_skill_state(updated_at DESC);

COMMENT ON TABLE public.match_skill_state IS 'Persisted skill state per match: mana, effects, flags.';
