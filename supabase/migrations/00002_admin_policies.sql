-- Admin policies for tournament management
-- Run this migration in Supabase SQL Editor

-- Helper function to check if user is admin
create or replace function is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.users
    where id = auth.uid() and is_admin = true
  );
end;
$$ language plpgsql security definer;

-- Tournaments: admins can manage
create policy "Admins can insert tournaments" on tournaments
  for insert with check (is_admin());
create policy "Admins can update tournaments" on tournaments
  for update using (is_admin());
create policy "Admins can delete tournaments" on tournaments
  for delete using (is_admin());

-- Regions: admins can manage
create policy "Admins can insert regions" on regions
  for insert with check (is_admin());
create policy "Admins can update regions" on regions
  for update using (is_admin());
create policy "Admins can delete regions" on regions
  for delete using (is_admin());

-- Teams: admins can manage
create policy "Admins can insert teams" on teams
  for insert with check (is_admin());
create policy "Admins can update teams" on teams
  for update using (is_admin());
create policy "Admins can delete teams" on teams
  for delete using (is_admin());

-- Games: admins can manage
create policy "Admins can insert games" on games
  for insert with check (is_admin());
create policy "Admins can update games" on games
  for update using (is_admin());
create policy "Admins can delete games" on games
  for delete using (is_admin());

-- Pick 'em days/games: admins can manage
create policy "Admins can insert pickem_days" on pickem_days
  for insert with check (is_admin());
create policy "Admins can update pickem_days" on pickem_days
  for update using (is_admin());
create policy "Admins can delete pickem_days" on pickem_days
  for delete using (is_admin());

create policy "Admins can insert pickem_games" on pickem_games
  for insert with check (is_admin());
create policy "Admins can update pickem_games" on pickem_games
  for update using (is_admin());
create policy "Admins can delete pickem_games" on pickem_games
  for delete using (is_admin());

-- Expenses: admins can manage
create policy "Admins can insert expenses" on expenses
  for insert with check (is_admin());
create policy "Admins can update expenses" on expenses
  for update using (is_admin());
create policy "Admins can delete expenses" on expenses
  for delete using (is_admin());

create policy "Admins can insert user_expenses" on user_expenses
  for insert with check (is_admin());
create policy "Admins can update user_expenses" on user_expenses
  for update using (is_admin());
create policy "Admins can delete user_expenses" on user_expenses
  for delete using (is_admin());

create policy "Admins can insert payments" on payments
  for insert with check (is_admin());
create policy "Admins can update payments" on payments
  for update using (is_admin());
create policy "Admins can delete payments" on payments
  for delete using (is_admin());

-- Users: admins can manage all users
create policy "Admins can insert users" on users
  for insert with check (is_admin());
create policy "Admins can update all users" on users
  for update using (is_admin());
create policy "Admins can delete users" on users
  for delete using (is_admin());

-- Game rules: admins can manage
create policy "Admins can insert game_rules" on game_rules
  for insert with check (is_admin());
create policy "Admins can update game_rules" on game_rules
  for update using (is_admin());
create policy "Admins can delete game_rules" on game_rules
  for delete using (is_admin());

-- User scores: admins can manage (for recalculation)
create policy "Admins can insert user_scores" on user_scores
  for insert with check (is_admin());
create policy "Admins can update user_scores" on user_scores
  for update using (is_admin());
create policy "Admins can delete user_scores" on user_scores
  for delete using (is_admin());
