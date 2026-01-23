-- Add is_participating field to auction_entries
-- Tracks whether a user is actively participating in the auction
-- (separate from payment status - handles no-shows, late arrivals, etc.)

alter table public.auction_entries
  add column if not exists is_participating boolean default false;

-- Add comment for clarity
comment on column public.auction_entries.is_participating is 'Whether user is actively participating in auction (handles no-shows)';
