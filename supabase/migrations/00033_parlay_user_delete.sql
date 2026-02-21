-- Allow users to delete their own unpaid parlays
-- Parlay picks cascade delete automatically via ON DELETE CASCADE

CREATE POLICY "Users can delete own unpaid parlays" ON parlays
  FOR DELETE USING (auth.uid() = user_id AND is_paid = false);
