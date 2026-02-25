-- Allow owners to update their own sounds; admins can update any
CREATE POLICY "Users can update own or admin can update any" ON soundboard_items
  FOR UPDATE USING (
    auth.uid() = created_by
    OR is_admin()
  );
