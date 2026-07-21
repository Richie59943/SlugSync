-- Group ownership transfer RPC.
-- Run after groups.sql in the Supabase SQL editor.

create or replace function transfer_group_ownership(
  target_group_id uuid,
  new_owner_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to transfer ownership.';
  end if;

  if not exists (
    select 1
    from group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = auth.uid()
      and gm.role = 'owner'
  ) then
    raise exception 'Only the current owner can transfer ownership.';
  end if;

  if new_owner_id = auth.uid() then
    raise exception 'Choose a different member as the new owner.';
  end if;

  if not exists (
    select 1
    from group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = new_owner_id
  ) then
    raise exception 'The new owner must already be a group member.';
  end if;

  update groups
  set created_by = new_owner_id
  where id = target_group_id;

  update group_members
  set role = 'owner'
  where group_id = target_group_id
    and user_id = new_owner_id;

  update group_members
  set role = 'member'
  where group_id = target_group_id
    and user_id = auth.uid();
end;
$$;

revoke execute on function transfer_group_ownership(uuid, uuid) from public, anon;
grant execute on function transfer_group_ownership(uuid, uuid) to authenticated;

-- Rollback:
-- revoke execute on function transfer_group_ownership(uuid, uuid) from authenticated;
-- drop function if exists transfer_group_ownership(uuid, uuid);
