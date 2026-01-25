-- Message reactions table (one reaction per user per message)
create table public.chat_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now(),
  unique(message_id, user_id)
);

-- Track when authors last viewed reactions on their messages
create table public.chat_reaction_read_status (
  user_id uuid primary key references public.users(id) on delete cascade,
  last_read_at timestamptz not null default now()
);

-- RLS policies
alter table public.chat_reactions enable row level security;
alter table public.chat_reaction_read_status enable row level security;

-- Anyone can read reactions (to display them)
create policy "Anyone can read reactions"
  on public.chat_reactions for select
  using (true);

-- Users can insert their own reactions
create policy "Users can insert own reactions"
  on public.chat_reactions for insert
  with check (user_id = auth.uid());

-- Users can update their own reactions
create policy "Users can update own reactions"
  on public.chat_reactions for update
  using (user_id = auth.uid());

-- Users can delete their own reactions
create policy "Users can delete own reactions"
  on public.chat_reactions for delete
  using (user_id = auth.uid());

-- Users can read their own reaction read status
create policy "Users can read own reaction status"
  on public.chat_reaction_read_status for select
  using (user_id = auth.uid());

-- Users can insert their own reaction read status
create policy "Users can insert own reaction status"
  on public.chat_reaction_read_status for insert
  with check (user_id = auth.uid());

-- Users can update their own reaction read status
create policy "Users can update own reaction status"
  on public.chat_reaction_read_status for update
  using (user_id = auth.uid());

-- Indexes for performance
create index idx_chat_reactions_message on public.chat_reactions(message_id);
create index idx_chat_reactions_user on public.chat_reactions(user_id);
create index idx_chat_reactions_created on public.chat_reactions(created_at);

-- Enable realtime for reactions table
alter publication supabase_realtime add table chat_reactions;
