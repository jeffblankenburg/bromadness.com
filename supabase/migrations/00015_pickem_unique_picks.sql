-- Ensure no duplicate picks exist (clean up first)
DELETE FROM pickem_picks
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY entry_id, game_id ORDER BY id) as rn
    FROM pickem_picks
    WHERE game_id IS NOT NULL
  ) t
  WHERE rn > 1
);

-- Add unique constraint to prevent duplicate picks (one pick per entry per game)
ALTER TABLE pickem_picks
  ADD CONSTRAINT unique_entry_game_pick UNIQUE (entry_id, game_id);
