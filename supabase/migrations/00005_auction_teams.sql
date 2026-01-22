-- Auction team ownership
-- Each user can own multiple teams, purchased at auction
create table public.auction_teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  bid_amount int not null default 0,
  created_at timestamptz default now(),

  -- Each team can only be owned by one user per tournament
  unique(tournament_id, team_id)
);

-- Enable RLS
alter table public.auction_teams enable row level security;

-- Everyone can view auction ownership
create policy "Anyone can view auction teams" on auction_teams
  for select using (true);

-- Admins can manage auction teams
create policy "Admins can insert auction teams" on auction_teams
  for insert with check (is_admin());

create policy "Admins can update auction teams" on auction_teams
  for update using (is_admin());

create policy "Admins can delete auction teams" on auction_teams
  for delete using (is_admin());

-- Index for fast lookups
create index auction_teams_user_idx on auction_teams(user_id);
create index auction_teams_tournament_idx on auction_teams(tournament_id);
