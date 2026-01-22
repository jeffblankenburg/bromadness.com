-- Auction settings for tournaments
-- Adds configurable entry fee, salary cap, bid increment, and payouts

-- Auction budget settings
alter table tournaments add column entry_fee int default 20;
alter table tournaments add column salary_cap int default 100;
alter table tournaments add column bid_increment int default 5;

-- Payout settings (stored as JSON for flexibility)
alter table tournaments add column auction_payouts jsonb default '{
  "championship_winner": 80,
  "championship_runnerup": 50,
  "points_1st": 110,
  "points_2nd": 80,
  "points_3rd": 60,
  "points_4th": 40
}'::jsonb;
