-- Add has_paid to track whether the user has paid for their parlay bet
-- Separate from is_paid which tracks whether admin has paid out winnings

ALTER TABLE public.parlays
  ADD COLUMN has_paid boolean DEFAULT false,
  ADD COLUMN has_paid_at timestamptz;

-- Update delete policy: users can only delete unpaid (has_paid = false) parlays
DROP POLICY IF EXISTS "Users can delete own unpaid parlays" ON parlays;
CREATE POLICY "Users can delete own unpaid parlays" ON parlays
  FOR DELETE USING (auth.uid() = user_id AND has_paid = false);
