-- Menu items for each day of the tournament
create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  day text not null, -- 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Random'
  meal_type text, -- 'Breakfast', 'Dinner', 'Misc', null for random items
  item_name text not null,
  provider text, -- who's bringing it
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.menu_items enable row level security;

-- Everyone can read menu items
create policy "Anyone can view menu items" on menu_items
  for select using (true);

-- Admins can manage menu items
create policy "Admins can insert menu items" on menu_items
  for insert with check (is_admin());

create policy "Admins can update menu items" on menu_items
  for update using (is_admin());

create policy "Admins can delete menu items" on menu_items
  for delete using (is_admin());

-- Index for fast lookups by tournament and day
create index menu_items_tournament_day_idx on menu_items(tournament_id, day);
