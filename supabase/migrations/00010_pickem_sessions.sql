-- Pick'em Sessions and Payment Tracking
-- Add session support for splitting games into early/late sessions
-- Add payment tracking for pick'em entries
-- Add configurable payouts

-- Add session column to pickem_games (1 = early games, 2 = late games)
alter table public.pickem_games
  add column session integer not null default 1 check (session in (1, 2));

-- Add payment tracking to pickem_entries
alter table public.pickem_entries
  add column has_paid boolean default false,
  add column paid_at timestamptz;

-- Add pickem payouts configuration to tournaments
alter table public.tournaments
  add column pickem_payouts jsonb default '{
    "entry_fee": 10,
    "session_1st": 0,
    "session_2nd": 0,
    "session_3rd": 0
  }'::jsonb;

-- Index for efficient session queries
create index idx_pickem_games_session on pickem_games(pickem_day_id, session);

-- Add RLS policies for pickem_entries update (for payment tracking by admin)
create policy "Admins can update pickem_entries" on pickem_entries for update
  using (exists (select 1 from users where id = auth.uid() and is_admin = true));

-- Allow users to update their own picks
create policy "Users can update own pickem_picks" on pickem_picks for update
  using (exists (select 1 from pickem_entries where id = entry_id and user_id = auth.uid()));
