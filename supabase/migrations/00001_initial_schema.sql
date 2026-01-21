-- Bromadness Database Schema
-- Run this migration in Supabase SQL Editor

-- ===========================================
-- USERS & PROFILES
-- ===========================================

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  phone varchar(15) not null unique,
  display_name varchar(100) not null,
  avatar_url text,
  is_admin boolean default false,
  is_active boolean default true,
  casino_credits integer default 1000,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===========================================
-- TOURNAMENT STRUCTURE
-- ===========================================

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  year integer not null unique,
  name varchar(100) not null,
  start_date date not null,
  end_date date not null,
  is_active boolean default false,
  picks_locked_at timestamptz,
  created_at timestamptz default now()
);

create table public.regions (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name varchar(50) not null,
  position integer not null,
  unique(tournament_id, name)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  region_id uuid not null references regions(id) on delete cascade,
  name varchar(100) not null,
  short_name varchar(20),
  seed integer not null check (seed >= 1 and seed <= 16),
  logo_url text,
  is_eliminated boolean default false,
  created_at timestamptz default now()
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  round integer not null check (round >= 1 and round <= 6),
  region_id uuid references regions(id),
  game_number integer not null,
  team1_id uuid references teams(id),
  team2_id uuid references teams(id),
  team1_score integer,
  team2_score integer,
  winner_id uuid references teams(id),
  scheduled_at timestamptz,
  completed_at timestamptz,
  next_game_id uuid references games(id),
  is_team1_slot boolean,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===========================================
-- BRACKET PICKS & SCORING
-- ===========================================

create table public.picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  game_id uuid not null references games(id) on delete cascade,
  picked_team_id uuid not null references teams(id),
  is_correct boolean,
  points_earned integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, game_id)
);

create table public.user_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  total_points integer default 0,
  correct_picks integer default 0,
  possible_points integer,
  updated_at timestamptz default now(),
  unique(user_id, tournament_id)
);

-- ===========================================
-- DAILY PICK 'EM
-- ===========================================

create table public.pickem_days (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  contest_date date not null,
  entry_fee decimal(10,2) default 0,
  tiebreaker_game_id uuid references games(id),
  is_locked boolean default false,
  created_at timestamptz default now(),
  unique(tournament_id, contest_date)
);

create table public.pickem_games (
  id uuid primary key default gen_random_uuid(),
  pickem_day_id uuid not null references pickem_days(id) on delete cascade,
  game_id uuid not null references games(id),
  spread decimal(4,1) not null,
  favorite_team_id uuid not null references teams(id),
  winner_team_id uuid references teams(id),
  created_at timestamptz default now()
);

create table public.pickem_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  pickem_day_id uuid not null references pickem_days(id) on delete cascade,
  tiebreaker_guess integer,
  correct_picks integer default 0,
  is_winner boolean default false,
  created_at timestamptz default now(),
  unique(user_id, pickem_day_id)
);

create table public.pickem_picks (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references pickem_entries(id) on delete cascade,
  pickem_game_id uuid not null references pickem_games(id) on delete cascade,
  picked_team_id uuid not null references teams(id),
  is_correct boolean,
  created_at timestamptz default now(),
  unique(entry_id, pickem_game_id)
);

-- ===========================================
-- CASINO
-- ===========================================

create table public.casino_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  game_type varchar(20) not null check (game_type in ('blackjack', 'video_poker', 'slots', 'admin_adjustment')),
  amount integer not null,
  balance_after integer not null,
  game_details jsonb,
  created_at timestamptz default now()
);

-- ===========================================
-- EXPENSES
-- ===========================================

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name varchar(50) not null,
  description text,
  sort_order integer default 0
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  category_id uuid not null references expense_categories(id),
  description text not null,
  total_amount decimal(10,2) not null,
  per_person_amount decimal(10,2),
  is_split_evenly boolean default true,
  due_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.user_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  expense_id uuid not null references expenses(id) on delete cascade,
  amount_owed decimal(10,2) not null,
  amount_paid decimal(10,2) default 0,
  is_fully_paid boolean default false,
  notes text,
  updated_at timestamptz default now(),
  unique(user_id, expense_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_expense_id uuid not null references user_expenses(id) on delete cascade,
  amount decimal(10,2) not null,
  payment_method varchar(50),
  recorded_by uuid not null references users(id),
  notes text,
  created_at timestamptz default now()
);

-- ===========================================
-- GAME RULES
-- ===========================================

create table public.game_rules (
  id uuid primary key default gen_random_uuid(),
  title varchar(100) not null,
  slug varchar(100) not null unique,
  content text not null,
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===========================================
-- INDEXES
-- ===========================================

create index idx_teams_tournament on teams(tournament_id);
create index idx_teams_region on teams(region_id);
create index idx_games_tournament on games(tournament_id);
create index idx_games_round on games(tournament_id, round);
create index idx_picks_user on picks(user_id);
create index idx_picks_tournament on picks(tournament_id);
create index idx_user_scores_tournament on user_scores(tournament_id);
create index idx_user_scores_points on user_scores(tournament_id, total_points desc);
create index idx_casino_transactions_user on casino_transactions(user_id);
create index idx_user_expenses_user on user_expenses(user_id);
create index idx_pickem_entries_user on pickem_entries(user_id);
create index idx_pickem_entries_day on pickem_entries(pickem_day_id);

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================

alter table users enable row level security;
alter table tournaments enable row level security;
alter table regions enable row level security;
alter table teams enable row level security;
alter table games enable row level security;
alter table picks enable row level security;
alter table user_scores enable row level security;
alter table pickem_days enable row level security;
alter table pickem_games enable row level security;
alter table pickem_entries enable row level security;
alter table pickem_picks enable row level security;
alter table casino_transactions enable row level security;
alter table expense_categories enable row level security;
alter table expenses enable row level security;
alter table user_expenses enable row level security;
alter table payments enable row level security;
alter table game_rules enable row level security;

-- Public read access for tournament data
create policy "Anyone can read tournaments" on tournaments for select using (true);
create policy "Anyone can read regions" on regions for select using (true);
create policy "Anyone can read teams" on teams for select using (true);
create policy "Anyone can read games" on games for select using (true);
create policy "Anyone can read game_rules" on game_rules for select using (is_active = true);
create policy "Anyone can read expense_categories" on expense_categories for select using (true);

-- Users can read all users (for leaderboard) and update own profile
create policy "Anyone can read users" on users for select using (true);
create policy "Users can update own profile" on users for update using (auth.uid() = id);

-- Picks: anyone can read (for viewing brackets), users can manage own
create policy "Anyone can read picks" on picks for select using (true);
create policy "Users can insert own picks" on picks for insert with check (auth.uid() = user_id);
create policy "Users can update own picks" on picks for update using (auth.uid() = user_id);

-- User scores: anyone can read (for leaderboard)
create policy "Anyone can read user_scores" on user_scores for select using (true);

-- Pick 'em: read all, manage own
create policy "Anyone can read pickem_days" on pickem_days for select using (true);
create policy "Anyone can read pickem_games" on pickem_games for select using (true);
create policy "Anyone can read pickem_entries" on pickem_entries for select using (true);
create policy "Anyone can read pickem_picks" on pickem_picks for select using (true);
create policy "Users can insert own pickem_entries" on pickem_entries for insert with check (auth.uid() = user_id);
create policy "Users can insert own pickem_picks" on pickem_picks for insert
  with check (exists (select 1 from pickem_entries where id = entry_id and user_id = auth.uid()));

-- Casino: users can read/write own transactions
create policy "Users can read own casino_transactions" on casino_transactions for select using (auth.uid() = user_id);
create policy "Users can insert own casino_transactions" on casino_transactions for insert with check (auth.uid() = user_id);

-- Expenses: users can read own, anyone can read categories
create policy "Users can read own user_expenses" on user_expenses for select using (auth.uid() = user_id);
create policy "Users can read expenses" on expenses for select using (true);
create policy "Users can read payments for own expenses" on payments for select
  using (exists (select 1 from user_expenses where id = user_expense_id and user_id = auth.uid()));

-- ===========================================
-- FUNCTIONS & TRIGGERS
-- ===========================================

-- Update updated_at timestamp
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger users_updated_at before update on users
  for each row execute function update_updated_at();
create trigger games_updated_at before update on games
  for each row execute function update_updated_at();
create trigger picks_updated_at before update on picks
  for each row execute function update_updated_at();
create trigger expenses_updated_at before update on expenses
  for each row execute function update_updated_at();
create trigger user_expenses_updated_at before update on user_expenses
  for each row execute function update_updated_at();
create trigger game_rules_updated_at before update on game_rules
  for each row execute function update_updated_at();

-- Update casino credits when transaction is inserted
create or replace function update_casino_credits()
returns trigger as $$
begin
  update users set casino_credits = new.balance_after where id = new.user_id;
  return new;
end;
$$ language plpgsql;

create trigger casino_credits_update after insert on casino_transactions
  for each row execute function update_casino_credits();

-- Update payment totals
create or replace function update_payment_totals()
returns trigger as $$
begin
  update user_expenses
  set
    amount_paid = (select coalesce(sum(amount), 0) from payments where user_expense_id = new.user_expense_id),
    is_fully_paid = (
      (select coalesce(sum(amount), 0) from payments where user_expense_id = new.user_expense_id) >= amount_owed
    )
  where id = new.user_expense_id;
  return new;
end;
$$ language plpgsql;

create trigger payment_totals_update after insert on payments
  for each row execute function update_payment_totals();

-- ===========================================
-- SEED DATA
-- ===========================================

-- Default expense categories
insert into expense_categories (name, description, sort_order) values
  ('Lodging', 'House rental and accommodations', 1),
  ('Food & Drinks', 'Groceries, meals, and beverages', 2),
  ('Activities', 'Entertainment and activities', 3),
  ('Pick ''Em Entry', 'Daily pick ''em entry fees', 4),
  ('Other', 'Miscellaneous expenses', 5);

-- Sample game rule: 3s and Ds
insert into game_rules (title, slug, content, sort_order) values
  ('3s & D''s', 'threes-and-ds', '## Three''s and D''s

### Setup
1. Establish **X**, the amount of the wager ($1, $2 etc...)
2. Coin toss to see who chooses first
3. Winning participant can defer or choose their team for the first half. Losing participant assumes the unchosen team
4. Deferring/Losing participant has the option of switching teams at halftime

### You WIN from your opponent when your team executes:

| Payout | Play |
|--------|------|
| **1X** | Any three point play (3 point shot or made basket and subsequent made foul shot) |
| **1X** | Any dunk (a made shot where the player''s hands touch the rim on completion of the shot) |
| **2X** | Any four point play (a made 3 point shot and subsequent made foul shot) |
| **3X** | Any shot made beyond half court |
| **3X** | Any game-winning shot made with no time left on the game clock |

### You OWE your opponent when your team executes:

| Payout | Play |
|--------|------|
| **1X** | Air ball (a shot that doesn''t hit the rim) on a three point shot attempt beyond halfcourt |
| **2X** | Air ball on a three point shot attempt in the frontcourt |
| **2X** | Any missed dunk (a missed, unblocked, unfouled shot where the player''s hands touch the rim on shot attempt) |

### Rules
- Payment is due immediately on each occurrence
- Any disputes will be settled by the gallery', 1);
