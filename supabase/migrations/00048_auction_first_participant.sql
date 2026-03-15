-- Add first participant selection for auction throwout order
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS auction_first_participant_id uuid REFERENCES users(id);
