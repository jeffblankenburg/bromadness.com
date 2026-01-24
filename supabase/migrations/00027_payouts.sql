-- Payouts tracking table
-- Tracks prize winners and payment status for all contest types

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  payout_type text not null,  -- e.g., 'auction_champion', 'auction_points_1st', 'pickem_session_1'
  payout_label text not null, -- Display name, e.g., 'Auction Champion', 'Points 1st Place'
  amount int not null default 0,
  user_id uuid references users(id) on delete set null,  -- Winner (null until determined)
  is_paid boolean default false,
  paid_at timestamptz,
  display_order int default 0,  -- For sorting prizes in display
  created_at timestamptz default now(),

  unique(tournament_id, payout_type)
);

-- Enable RLS
alter table public.payouts enable row level security;

-- Everyone can view payouts
create policy "Anyone can view payouts" on payouts
  for select using (true);

-- Admins can manage payouts
create policy "Admins can insert payouts" on payouts
  for insert with check (is_admin());

create policy "Admins can update payouts" on payouts
  for update using (is_admin());

create policy "Admins can delete payouts" on payouts
  for delete using (is_admin());

-- Indexes for fast lookups
create index payouts_tournament_idx on payouts(tournament_id);
create index payouts_user_idx on payouts(user_id);
