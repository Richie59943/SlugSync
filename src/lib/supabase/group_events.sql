-- Group events feature: explicitly share user-owned events with groups.
-- Run after groups.sql and events_visibility.sql in the Supabase SQL editor.

create table if not exists group_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  shared_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (group_id, event_id)
);

create index if not exists group_events_group_id_idx
  on group_events (group_id);

create index if not exists group_events_event_id_idx
  on group_events (event_id);

create index if not exists group_events_shared_by_idx
  on group_events (shared_by);

-- Security-definer helpers avoid recursive RLS and keep membership/event-owner
-- checks consistent across group_events policies.
create or replace function owns_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from events e
    where e.id = target_event_id
      and e.user_id = auth.uid()
  );
$$;

create or replace function can_share_event_with_group(
  target_group_id uuid,
  target_event_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select owns_event(target_event_id) and is_group_member(target_group_id);
$$;

create or replace function can_view_group_shared_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from group_events ge
    where ge.event_id = target_event_id
      and is_group_member(ge.group_id)
  );
$$;

revoke execute on function owns_event(uuid) from public, anon;
revoke execute on function can_share_event_with_group(uuid, uuid) from public, anon;
revoke execute on function can_view_group_shared_event(uuid) from public, anon;
grant execute on function owns_event(uuid) to authenticated;
grant execute on function can_share_event_with_group(uuid, uuid) to authenticated;
grant execute on function can_view_group_shared_event(uuid) to authenticated;

alter table group_events enable row level security;

drop policy if exists "Group members can view group event links" on group_events;
create policy "Group members can view group event links"
  on group_events for select
  to authenticated
  using (is_group_member(group_id));

drop policy if exists "Event owners can share events with their groups" on group_events;
create policy "Event owners can share events with their groups"
  on group_events for insert
  to authenticated
  with check (
    shared_by = auth.uid()
    and can_share_event_with_group(group_id, event_id)
  );

drop policy if exists "Event owners and group admins can remove group events" on group_events;
create policy "Event owners and group admins can remove group events"
  on group_events for delete
  to authenticated
  using (
    owns_event(event_id)
    or is_group_admin(group_id)
  );

-- group_events rows are relationship records. Change them by inserting or
-- deleting rows so role/group/event ownership checks stay easy to reason about.
revoke update on group_events from authenticated;

drop policy if exists "Group members can view shared events" on events;
create policy "Group members can view shared events"
  on events for select
  to authenticated
  using (can_view_group_shared_event(id));
