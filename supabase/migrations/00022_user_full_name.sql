-- Add full_name field to users table
-- The existing display_name becomes the "nickname" shown publicly
-- full_name stores the person's real full name for admin reference

alter table public.users
  add column if not exists full_name varchar(200);

-- Add comment for clarity
comment on column public.users.display_name is 'Nickname/display name shown publicly on the site';
comment on column public.users.full_name is 'Full legal name for admin reference';
