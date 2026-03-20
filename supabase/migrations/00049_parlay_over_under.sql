-- Add over/under total to games table
ALTER TABLE games ADD COLUMN over_under_total decimal(4,1);

-- Add pick_type and picked_over_under to parlay_picks
ALTER TABLE parlay_picks ADD COLUMN pick_type text NOT NULL DEFAULT 'spread';
ALTER TABLE parlay_picks ADD COLUMN picked_over_under text;

-- Make picked_team_id nullable (O/U picks don't reference a team)
ALTER TABLE parlay_picks ALTER COLUMN picked_team_id DROP NOT NULL;

-- Add CHECK constraint: spread picks must have picked_team_id, O/U picks must have picked_over_under
ALTER TABLE parlay_picks ADD CONSTRAINT parlay_picks_type_check CHECK (
  (pick_type = 'spread' AND picked_team_id IS NOT NULL AND picked_over_under IS NULL)
  OR
  (pick_type = 'over_under' AND picked_over_under IN ('over', 'under') AND picked_team_id IS NULL)
);

-- Change unique constraint: allow both a spread and O/U pick on the same game
ALTER TABLE parlay_picks DROP CONSTRAINT parlay_picks_parlay_id_game_id_key;
ALTER TABLE parlay_picks ADD CONSTRAINT parlay_picks_parlay_id_game_id_pick_type_key UNIQUE(parlay_id, game_id, pick_type);
