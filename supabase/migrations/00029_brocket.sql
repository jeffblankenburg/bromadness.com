-- Brocket Feature: Straight-up winner picking contest for Round 1 games
-- Scoring: Points = seed of correctly picked team

-- Add brocket_payouts configuration to tournaments
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS brocket_payouts jsonb DEFAULT '{"entry_fee": 20, "enabled": true}'::jsonb;

-- Brocket entries table (one per user per tournament)
CREATE TABLE public.brocket_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  has_paid boolean DEFAULT false,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, tournament_id)
);

-- Brocket picks table
CREATE TABLE public.brocket_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.brocket_entries(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  picked_team_id uuid NOT NULL REFERENCES public.teams(id),
  is_correct boolean,
  created_at timestamptz DEFAULT now(),
  UNIQUE(entry_id, game_id)
);

-- Indexes
CREATE INDEX idx_brocket_entries_user ON brocket_entries(user_id);
CREATE INDEX idx_brocket_entries_tournament ON brocket_entries(tournament_id);
CREATE INDEX idx_brocket_picks_entry ON brocket_picks(entry_id);
CREATE INDEX idx_brocket_picks_game ON brocket_picks(game_id);

-- Enable Row Level Security
ALTER TABLE brocket_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE brocket_picks ENABLE ROW LEVEL SECURITY;

-- Read policies (anyone can read for leaderboard)
CREATE POLICY "Anyone can read brocket_entries" ON brocket_entries FOR SELECT USING (true);
CREATE POLICY "Anyone can read brocket_picks" ON brocket_picks FOR SELECT USING (true);

-- Insert policies (users can create their own)
CREATE POLICY "Users can insert own brocket_entries" ON brocket_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert own brocket_picks" ON brocket_picks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM brocket_entries WHERE id = entry_id AND user_id = auth.uid())
  );

-- Update policies (users can update their own)
CREATE POLICY "Users can update own brocket_picks" ON brocket_picks
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM brocket_entries WHERE id = entry_id AND user_id = auth.uid())
  );

-- Admin policies
CREATE POLICY "Admins can update brocket_entries" ON brocket_entries FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can insert brocket_entries" ON brocket_entries FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can update brocket_picks" ON brocket_picks FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can delete brocket_picks" ON brocket_picks FOR DELETE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));
