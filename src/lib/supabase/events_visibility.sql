-- Adds private/community visibility to events so users can decide whether an
-- event stays on their own dashboard/calendar or appears on the community
-- dashboard too. Run in the Supabase SQL editor.

alter table events
  add column if not exists visibility text;

alter table events
  alter column visibility set default 'private';

alter table events
  drop constraint if exists events_visibility_check;

update events
set visibility = case
  when visibility in ('community', 'public') or user_id is null then 'community'
  else 'private'
end;

alter table events
  alter column visibility set not null;

alter table events
  add constraint events_visibility_check
  check (visibility in ('private', 'community'));

alter table events enable row level security;

drop policy if exists "Events are viewable by everyone" on events;
drop policy if exists "Public events are viewable by everyone" on events;
drop policy if exists "Community events are viewable by authenticated users" on events;
create policy "Community events are viewable by authenticated users"
  on events for select
  to authenticated
  using (visibility = 'community');

drop policy if exists "Users can view their own events" on events;
create policy "Users can view their own events"
  on events for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own events" on events;
create policy "Users can create their own events"
  on events for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can edit their own events" on events;
create policy "Users can edit their own events"
  on events for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Events can be deleted by everyone" on events;
drop policy if exists "Users can delete their own events" on events;
create policy "Users can delete their own events"
  on events for delete
  to authenticated
  using (auth.uid() = user_id);
