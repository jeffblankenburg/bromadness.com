-- Trip cost tracking for each user
create table public.trip_costs (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  amount_owed decimal(10, 2) not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(tournament_id, user_id)
);

-- Payment entries against a user's trip cost
create table public.trip_payments (
  id uuid primary key default gen_random_uuid(),
  trip_cost_id uuid not null references public.trip_costs(id) on delete cascade,
  amount decimal(10, 2) not null,
  note text,
  paid_at timestamptz default now(),
  created_at timestamptz default now()
);

-- RLS policies
alter table public.trip_costs enable row level security;
alter table public.trip_payments enable row level security;

-- Users can view their own trip costs
create policy "Users can view own trip cost"
  on public.trip_costs for select
  using (user_id = auth.uid());

-- Admins can manage all trip costs
create policy "Admins can manage trip costs"
  on public.trip_costs for all
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and is_admin = true
    )
  );

-- Users can view their own payments
create policy "Users can view own trip payments"
  on public.trip_payments for select
  using (
    exists (
      select 1 from public.trip_costs
      where id = trip_cost_id and user_id = auth.uid()
    )
  );

-- Admins can manage all trip payments
create policy "Admins can manage trip payments"
  on public.trip_payments for all
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and is_admin = true
    )
  );

-- Indexes
create index idx_trip_costs_tournament on public.trip_costs(tournament_id);
create index idx_trip_costs_user on public.trip_costs(user_id);
create index idx_trip_payments_cost on public.trip_payments(trip_cost_id);
