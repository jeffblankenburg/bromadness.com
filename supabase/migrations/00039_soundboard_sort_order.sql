-- Add sort_order column for custom soundboard item ordering
ALTER TABLE public.soundboard_items
ADD COLUMN sort_order integer;

-- Backfill existing items based on current created_at order
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM soundboard_items
)
UPDATE soundboard_items
SET sort_order = ordered.rn
FROM ordered
WHERE soundboard_items.id = ordered.id;

-- Now make it NOT NULL with a default
ALTER TABLE public.soundboard_items
ALTER COLUMN sort_order SET NOT NULL;

ALTER TABLE public.soundboard_items
ALTER COLUMN sort_order SET DEFAULT 0;

-- Index for ordering queries
CREATE INDEX idx_soundboard_items_sort_order ON soundboard_items(sort_order);
