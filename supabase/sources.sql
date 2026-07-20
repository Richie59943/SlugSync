-- Sources feature: saved website URLs users want events parsed from.
-- Run in the Supabase SQL editor.

create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  label text,
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);

-- Prevent the same user from saving the same URL twice.
create unique index if not exists sources_user_id_url_idx
  on sources (user_id, url);

create index if not exists sources_user_id_idx
  on sources (user_id);

alter table sources enable row level security;

drop policy if exists "Users can view their own sources" on sources;
create policy "Users can view their own sources"
  on sources for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own sources" on sources;
create policy "Users can create their own sources"
  on sources for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own sources" on sources;
create policy "Users can update their own sources"
  on sources for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own sources" on sources;
create policy "Users can delete their own sources"
  on sources for delete
  to authenticated
  using (auth.uid() = user_id);
