-- Allow admins to insert pickem_entries (for payment tracking)
create policy "Admins can insert pickem_entries" on pickem_entries for insert
  with check (exists (select 1 from users where id = auth.uid() and is_admin = true));

-- Allow admins to insert pickem_days
create policy "Admins can insert pickem_days" on pickem_days for insert
  with check (exists (select 1 from users where id = auth.uid() and is_admin = true));

-- Allow admins to insert pickem_games
create policy "Admins can insert pickem_games" on pickem_games for insert
  with check (exists (select 1 from users where id = auth.uid() and is_admin = true));
