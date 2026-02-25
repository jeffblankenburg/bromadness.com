-- Soundboard feature: add permission flag to users
ALTER TABLE public.users
ADD COLUMN can_use_soundboard boolean DEFAULT false;
