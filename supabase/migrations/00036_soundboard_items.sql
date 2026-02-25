-- Dynamic soundboard: user-uploaded sounds with thumbnails

CREATE TABLE public.soundboard_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(50) NOT NULL,
  audio_url text NOT NULL,
  image_url text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_soundboard_items_created_by ON soundboard_items(created_by);
CREATE INDEX idx_soundboard_items_created_at ON soundboard_items(created_at);

ALTER TABLE soundboard_items ENABLE ROW LEVEL SECURITY;

-- Anyone can read sounds (SoundListener runs for all users)
CREATE POLICY "Anyone can read soundboard_items" ON soundboard_items
  FOR SELECT USING (true);

-- Users with soundboard access can insert their own
CREATE POLICY "Soundboard users can insert own items" ON soundboard_items
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND can_use_soundboard = true)
  );

-- Owners can delete their own; admins can delete any
CREATE POLICY "Users can delete own or admin can delete any" ON soundboard_items
  FOR DELETE USING (
    auth.uid() = created_by
    OR is_admin()
  );
