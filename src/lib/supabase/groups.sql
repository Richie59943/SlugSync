-- Groups feature: group records, memberships, ownership, and RLS.
-- Run in the Supabase SQL editor.

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create index if not exists groups_created_by_idx
  on groups (created_by);

create index if not exists group_members_group_id_idx
  on group_members (group_id);

create index if not exists group_members_user_id_idx
  on group_members (user_id);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists groups_set_updated_at on groups;
create trigger groups_set_updated_at
  before update on groups
  for each row
  execute function set_updated_at();

create or replace function add_group_creator_as_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (group_id, user_id)
  do update set role = 'owner';

  return new;
end;
$$;

drop trigger if exists groups_add_creator_as_owner on groups;
create trigger groups_add_creator_as_owner
  after insert on groups
  for each row
  execute function add_group_creator_as_owner();

-- Security-definer helpers keep groups/group_members policies from recursively
-- querying each other through RLS.
create or replace function is_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = auth.uid()
  );
$$;

create or replace function is_group_admin(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = auth.uid()
      and gm.role in ('owner', 'admin')
  );
$$;

create or replace function is_group_owner(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from groups g
    where g.id = target_group_id
      and g.created_by = auth.uid()
  )
  or exists (
    select 1
    from group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = auth.uid()
      and gm.role = 'owner'
  );
$$;

revoke execute on function is_group_member(uuid) from public, anon;
revoke execute on function is_group_admin(uuid) from public, anon;
revoke execute on function is_group_owner(uuid) from public, anon;
grant execute on function is_group_member(uuid) to authenticated;
grant execute on function is_group_admin(uuid) to authenticated;
grant execute on function is_group_owner(uuid) to authenticated;

create or replace function can_manage_group_member(
  target_group_id uuid,
  target_user_id uuid,
  target_role text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    is_group_owner(target_group_id)
    or (
      is_group_admin(target_group_id)
      and target_role = 'member'
      and not exists (
        select 1
        from group_members gm
        where gm.group_id = target_group_id
          and gm.user_id = target_user_id
          and gm.role in ('owner', 'admin')
      )
    );
$$;

revoke execute on function can_manage_group_member(uuid, uuid, text) from public, anon;
grant execute on function can_manage_group_member(uuid, uuid, text) to authenticated;

alter table groups enable row level security;
alter table group_members enable row level security;

drop policy if exists "Authenticated users can create their own groups" on groups;
create policy "Authenticated users can create their own groups"
  on groups for insert
  to authenticated
  with check (auth.uid() = created_by);

drop policy if exists "Members can view their groups" on groups;
create policy "Members can view their groups"
  on groups for select
  to authenticated
  using (created_by = auth.uid() or is_group_member(id));

drop policy if exists "Owners and admins can update groups" on groups;
create policy "Owners and admins can update groups"
  on groups for update
  to authenticated
  using (is_group_admin(id))
  with check (is_group_admin(id));

drop policy if exists "Owners can delete groups" on groups;
create policy "Owners can delete groups"
  on groups for delete
  to authenticated
  using (is_group_owner(id));

drop policy if exists "Members can view memberships for their groups" on group_members;
create policy "Members can view memberships for their groups"
  on group_members for select
  to authenticated
  using (user_id = auth.uid() or is_group_member(group_id));

drop policy if exists "Owners and admins can add group members" on group_members;
create policy "Owners and admins can add group members"
  on group_members for insert
  to authenticated
  with check (can_manage_group_member(group_id, user_id, role));

drop policy if exists "Owners and admins can update group member roles" on group_members;
create policy "Owners and admins can update group member roles"
  on group_members for update
  to authenticated
  using (can_manage_group_member(group_id, user_id, role))
  with check (can_manage_group_member(group_id, user_id, role));

drop policy if exists "Members can leave and admins can remove group members" on group_members;
create policy "Members can leave and admins can remove group members"
  on group_members for delete
  to authenticated
  using (
    role <> 'owner'
    and (
      user_id = auth.uid()
      or can_manage_group_member(group_id, user_id, role)
    )
  );

-- Column privileges prevent RLS-approved updates from changing immutable
-- ownership columns. Membership changes should happen by insert/delete, with
-- updates limited to role changes.
revoke update on groups from authenticated;
grant update (name, description) on groups to authenticated;

revoke update on group_members from authenticated;
grant update (role) on group_members to authenticated;
