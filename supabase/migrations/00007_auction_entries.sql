-- Auction entry fee tracking
-- Tracks who has paid their entry fee for the auction

create table public.auction_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  has_paid boolean default false,
  paid_at timestamptz,
  created_at timestamptz default now(),

  unique(tournament_id, user_id)
);

-- Enable RLS
alter table public.auction_entries enable row level security;

-- Everyone can view auction entries
create policy "Anyone can view auction entries" on auction_entries
  for select using (true);

-- Admins can manage auction entries
create policy "Admins can insert auction entries" on auction_entries
  for insert with check (is_admin());

create policy "Admins can update auction entries" on auction_entries
  for update using (is_admin());

create policy "Admins can delete auction entries" on auction_entries
  for delete using (is_admin());

-- Index for fast lookups
create index auction_entries_tournament_idx on auction_entries(tournament_id);
create index auction_entries_user_idx on auction_entries(user_id);
