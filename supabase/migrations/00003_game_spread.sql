-- Add spread (point line) to games
-- The spread is always from the favorite's perspective (negative number)
-- e.g., spread = 14.5 with favorite_team_id means that team is -14.5

alter table public.games
  add column spread decimal(4,1),
  add column favorite_team_id uuid references teams(id);
