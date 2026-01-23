-- Allow admins to delete pickem_picks and pickem_entries

create policy "Admins can delete pickem_picks"
  on public.pickem_picks for delete
  using (exists (select 1 from public.users where id = auth.uid() and is_admin = true));

create policy "Admins can delete pickem_entries"
  on public.pickem_entries for delete
  using (exists (select 1 from public.users where id = auth.uid() and is_admin = true));
