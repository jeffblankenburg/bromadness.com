-- System messages support for chat (countdown broadcasts, etc.)

-- Make user_id nullable so system messages don't need a real user
ALTER TABLE chat_messages ALTER COLUMN user_id DROP NOT NULL;

-- Add system message fields
ALTER TABLE chat_messages ADD COLUMN is_system boolean DEFAULT false;
ALTER TABLE chat_messages ADD COLUMN system_name text;

-- Create countdown storage bucket for player images
INSERT INTO storage.buckets (id, name, public)
VALUES ('countdown', 'countdown', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to countdown images
CREATE POLICY "Anyone can view countdown images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'countdown');

-- Allow admins to upload countdown images
CREATE POLICY "Admins can upload countdown images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'countdown'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- Allow admins to delete countdown images
CREATE POLICY "Admins can delete countdown images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'countdown'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND is_admin = true
  )
);
