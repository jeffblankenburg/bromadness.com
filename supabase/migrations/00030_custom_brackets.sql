-- Custom Brackets Feature: User-created tournament brackets
-- Supports single and double elimination formats

-- Main brackets table
CREATE TABLE public.custom_brackets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bracket_type varchar(20) NOT NULL CHECK (bracket_type IN ('single', 'double')),
  status varchar(20) DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  winner_id uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Participants in a bracket
CREATE TABLE public.custom_bracket_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bracket_id uuid NOT NULL REFERENCES public.custom_brackets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  seed integer NOT NULL,
  is_eliminated boolean DEFAULT false,
  eliminated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(bracket_id, user_id),
  UNIQUE(bracket_id, seed)
);

-- Matches/games in a bracket
CREATE TABLE public.custom_bracket_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bracket_id uuid NOT NULL REFERENCES public.custom_brackets(id) ON DELETE CASCADE,
  round integer NOT NULL,
  match_number integer NOT NULL,
  bracket_side varchar(10) DEFAULT 'winners' CHECK (bracket_side IN ('winners', 'losers', 'finals')),
  participant1_id uuid REFERENCES public.custom_bracket_participants(id),
  participant2_id uuid REFERENCES public.custom_bracket_participants(id),
  winner_id uuid REFERENCES public.custom_bracket_participants(id),
  loser_goes_to_match_id uuid REFERENCES public.custom_bracket_matches(id),
  winner_goes_to_match_id uuid REFERENCES public.custom_bracket_matches(id),
  winner_is_slot1 boolean,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(bracket_id, bracket_side, round, match_number)
);

-- Indexes
CREATE INDEX idx_custom_brackets_created_by ON custom_brackets(created_by);
CREATE INDEX idx_custom_brackets_status ON custom_brackets(status);
CREATE INDEX idx_custom_bracket_participants_bracket ON custom_bracket_participants(bracket_id);
CREATE INDEX idx_custom_bracket_participants_user ON custom_bracket_participants(user_id);
CREATE INDEX idx_custom_bracket_matches_bracket ON custom_bracket_matches(bracket_id);
CREATE INDEX idx_custom_bracket_matches_round ON custom_bracket_matches(bracket_id, round);

-- Enable Row Level Security
ALTER TABLE custom_brackets ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_bracket_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_bracket_matches ENABLE ROW LEVEL SECURITY;

-- Read policies (anyone can read for viewing shared brackets)
CREATE POLICY "Anyone can read custom_brackets" ON custom_brackets FOR SELECT USING (true);
CREATE POLICY "Anyone can read custom_bracket_participants" ON custom_bracket_participants FOR SELECT USING (true);
CREATE POLICY "Anyone can read custom_bracket_matches" ON custom_bracket_matches FOR SELECT USING (true);

-- Insert policies (users can create their own brackets)
CREATE POLICY "Users can insert own custom_brackets" ON custom_brackets
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can insert custom_bracket_participants" ON custom_bracket_participants
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM custom_brackets WHERE id = bracket_id AND created_by = auth.uid())
  );

CREATE POLICY "Users can insert custom_bracket_matches" ON custom_bracket_matches
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM custom_brackets WHERE id = bracket_id AND created_by = auth.uid())
  );

-- Update policies (users can update their own brackets)
CREATE POLICY "Users can update own custom_brackets" ON custom_brackets
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can update own custom_bracket_participants" ON custom_bracket_participants
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM custom_brackets WHERE id = bracket_id AND created_by = auth.uid())
  );

CREATE POLICY "Users can update own custom_bracket_matches" ON custom_bracket_matches
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM custom_brackets WHERE id = bracket_id AND created_by = auth.uid())
  );

-- Delete policies (users can delete their own brackets)
CREATE POLICY "Users can delete own custom_brackets" ON custom_brackets
  FOR DELETE USING (created_by = auth.uid());

-- Triggers for updated_at
CREATE TRIGGER custom_brackets_updated_at BEFORE UPDATE ON custom_brackets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER custom_bracket_matches_updated_at BEFORE UPDATE ON custom_bracket_matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
