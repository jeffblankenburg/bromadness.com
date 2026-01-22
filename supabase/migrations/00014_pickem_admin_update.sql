-- Allow admins to update pickem_picks (for setting is_correct when results are entered)
CREATE POLICY "Admins can update pickem_picks" ON pickem_picks FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));
