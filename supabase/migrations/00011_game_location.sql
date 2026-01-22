-- Add location column to games table
alter table public.games
  add column location text;

-- Add comment for clarity
comment on column public.games.location is 'Physical location/venue where the game is played';
