-- Soundboard categories for organizing sounds
CREATE TABLE public.soundboard_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(30) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_soundboard_categories_sort_order ON soundboard_categories(sort_order);

ALTER TABLE soundboard_categories ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read categories
CREATE POLICY "Authenticated users can read soundboard_categories" ON soundboard_categories
  FOR SELECT USING (auth.role() = 'authenticated');

-- Soundboard users can manage categories
CREATE POLICY "Soundboard users can insert categories" ON soundboard_categories
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND can_use_soundboard = true)
  );

CREATE POLICY "Soundboard users can update categories" ON soundboard_categories
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND can_use_soundboard = true)
  );

CREATE POLICY "Soundboard users can delete categories" ON soundboard_categories
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND can_use_soundboard = true)
  );

-- Join table for many-to-many: items <-> categories
CREATE TABLE public.soundboard_item_categories (
  item_id uuid NOT NULL REFERENCES public.soundboard_items(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.soundboard_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, category_id)
);

ALTER TABLE soundboard_item_categories ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read associations
CREATE POLICY "Authenticated users can read soundboard_item_categories" ON soundboard_item_categories
  FOR SELECT USING (auth.role() = 'authenticated');

-- Soundboard users can manage associations
CREATE POLICY "Soundboard users can insert item_categories" ON soundboard_item_categories
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND can_use_soundboard = true)
  );

CREATE POLICY "Soundboard users can delete item_categories" ON soundboard_item_categories
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND can_use_soundboard = true)
  );
