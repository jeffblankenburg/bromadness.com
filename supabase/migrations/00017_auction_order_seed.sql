-- Add auction_order_seed to tournaments for randomizing throwout order
alter table public.tournaments
  add column if not exists auction_order_seed text;
