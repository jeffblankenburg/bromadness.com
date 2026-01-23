-- First revert the +4 hours that was added
update public.games
set scheduled_at = scheduled_at - interval '4 hours'
where scheduled_at is not null;

-- Change scheduled_at from timestamptz to timestamp (no timezone)
-- This stores the time as-is without any UTC conversion
alter table public.games
alter column scheduled_at type timestamp without time zone;

-- Change dev_simulated_time to timestamp as well
alter table public.tournaments
alter column dev_simulated_time type timestamp without time zone;
