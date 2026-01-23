-- Add teams_per_player setting for auction
-- This is the number of teams each player is required to purchase (typically 2, 3, or 4)
-- Note: $0 bonus teams (e.g., free #16 with #13 purchase) don't count against this limit

alter table tournaments add column teams_per_player int default 3;
