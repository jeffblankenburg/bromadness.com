-- Parlays Feature: 4-team parlay bets against the spread
-- Payout: 8:1 (bet $1, win $9). Max bet: $10.

-- Parlays table (one per parlay bet)
CREATE TABLE public.parlays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  bet_amount integer NOT NULL CHECK (bet_amount >= 1 AND bet_amount <= 10),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
  is_paid boolean DEFAULT false,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Parlay picks table (4 picks per parlay)
CREATE TABLE public.parlay_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parlay_id uuid NOT NULL REFERENCES public.parlays(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  picked_team_id uuid NOT NULL REFERENCES public.teams(id),
  is_correct boolean,
  created_at timestamptz DEFAULT now(),
  UNIQUE(parlay_id, game_id)
);

-- Indexes
CREATE INDEX idx_parlays_user ON parlays(user_id);
CREATE INDEX idx_parlays_tournament ON parlays(tournament_id);
CREATE INDEX idx_parlays_status ON parlays(status);
CREATE INDEX idx_parlay_picks_parlay ON parlay_picks(parlay_id);
CREATE INDEX idx_parlay_picks_game ON parlay_picks(game_id);

-- Enable Row Level Security
ALTER TABLE parlays ENABLE ROW LEVEL SECURITY;
ALTER TABLE parlay_picks ENABLE ROW LEVEL SECURITY;

-- Read policies (anyone can read)
CREATE POLICY "Anyone can read parlays" ON parlays FOR SELECT USING (true);
CREATE POLICY "Anyone can read parlay_picks" ON parlay_picks FOR SELECT USING (true);

-- Insert policies (users can create their own)
CREATE POLICY "Users can insert own parlays" ON parlays
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert own parlay_picks" ON parlay_picks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM parlays WHERE id = parlay_id AND user_id = auth.uid())
  );

-- Admin policies (update and delete)
CREATE POLICY "Admins can update parlays" ON parlays FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "Admins can update parlay_picks" ON parlay_picks FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "Admins can delete parlays" ON parlays FOR DELETE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "Admins can delete parlay_picks" ON parlay_picks FOR DELETE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));
