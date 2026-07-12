-- Sprint 2.4 — required. Run this in the Supabase SQL editor.
-- Stores each signed-in user's dashboard filter selections.

create table if not exists user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  clubs text[] default '{}',
  classes text[] default '{}',
  categories text[] default '{}',
  updated_at timestamptz default now()
);

alter table user_preferences enable row level security;

drop policy if exists "Users can view their own preferences" on user_preferences;
create policy "Users can view their own preferences"
  on user_preferences for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own preferences" on user_preferences;
create policy "Users can insert their own preferences"
  on user_preferences for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own preferences" on user_preferences;
create policy "Users can update their own preferences"
  on user_preferences for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
