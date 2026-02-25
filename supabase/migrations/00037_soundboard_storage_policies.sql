-- Storage policies for the soundboard bucket
-- Bucket must be created first via Supabase dashboard (public bucket)

-- Anyone can read/download sound files (needed for playback)
CREATE POLICY "Anyone can read soundboard files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'soundboard');

-- Authenticated users can upload to their own folder
CREATE POLICY "Authenticated users can upload soundboard files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'soundboard'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own files; admins can delete any
CREATE POLICY "Users can delete own soundboard files or admin"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'soundboard'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR is_admin()
    )
  );
