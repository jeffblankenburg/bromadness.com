-- Add auction_complete flag to tournaments
alter table public.tournaments
  add column if not exists auction_complete boolean default false;
