-- Add explicit brocket eligibility flag to games instead of inferring from day-of-week
ALTER TABLE games ADD COLUMN IF NOT EXISTS is_brocket boolean DEFAULT false;

-- Set existing Round 1 games as brocket-eligible by default
-- (Admin can adjust via tournament management)
UPDATE games SET is_brocket = true WHERE round = 1;
