-- App-wide settings (key-value store)
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES public.users(id)
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read settings
CREATE POLICY "Authenticated users can read app_settings" ON app_settings
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can insert/update/delete
CREATE POLICY "Admins can insert app_settings" ON app_settings
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Admins can update app_settings" ON app_settings
  FOR UPDATE USING (is_admin());

CREATE POLICY "Admins can delete app_settings" ON app_settings
  FOR DELETE USING (is_admin());

-- Seed the soundboard broadcast setting (default ON to preserve current behavior)
INSERT INTO app_settings (key, value)
VALUES ('soundboard_broadcast_enabled', 'true');
