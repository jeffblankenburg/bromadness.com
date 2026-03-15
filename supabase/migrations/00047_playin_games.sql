-- Allow round 0 (First Four play-in games) in the games table
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_round_check;
ALTER TABLE games ADD CONSTRAINT games_round_check CHECK (round >= 0 AND round <= 6);
