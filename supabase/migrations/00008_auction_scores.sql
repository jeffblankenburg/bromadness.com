-- Auction scores tracking
-- Denormalized table for fast leaderboard queries
-- Points = sum of seeds of winning teams owned by user

create table public.auction_scores (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  total_points int default 0,
  updated_at timestamptz default now(),

  unique(tournament_id, user_id)
);

-- Enable RLS
alter table public.auction_scores enable row level security;

-- Everyone can view auction scores
create policy "Anyone can view auction scores" on auction_scores
  for select using (true);

-- Admins can manage auction scores
create policy "Admins can insert auction scores" on auction_scores
  for insert with check (is_admin());

create policy "Admins can update auction scores" on auction_scores
  for update using (is_admin());

create policy "Admins can delete auction scores" on auction_scores
  for delete using (is_admin());

-- Index for fast lookups
create index auction_scores_tournament_idx on auction_scores(tournament_id);
create index auction_scores_user_idx on auction_scores(user_id);
