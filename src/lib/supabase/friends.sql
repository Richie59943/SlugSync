-- Friends feature: profiles RLS, friendships table, free/busy RPC.
-- Run in the Supabase SQL editor.

-- 1) profiles: codify RLS. The table was created ad-hoc in the dashboard, so
-- this bundles the owner insert/update policies with the cross-user read —
-- enabling RLS without them would break Profile.jsx saves.
alter table profiles enable row level security;

drop policy if exists "Profiles are viewable by authenticated users" on profiles;
create policy "Profiles are viewable by authenticated users"
  on profiles for select
  to authenticated
  using (true);

drop policy if exists "Users can insert their own profile" on profiles;
create policy "Users can insert their own profile"
  on profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on profiles;
create policy "Users can update their own profile"
  on profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 2) friendships
create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz default now(),
  check (requester_id <> addressee_id)
);

-- direction-agnostic uniqueness: blocks A->B and B->A duplicates
create unique index if not exists friendships_pair_unique
  on friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

alter table friendships enable row level security;

drop policy if exists "Parties can view their friendships" on friendships;
create policy "Parties can view their friendships"
  on friendships for select
  to authenticated
  using (auth.uid() in (requester_id, addressee_id));

drop policy if exists "Users can send friend requests" on friendships;
create policy "Users can send friend requests"
  on friendships for insert
  to authenticated
  with check (auth.uid() = requester_id and status = 'pending');

drop policy if exists "Addressee can accept friend requests" on friendships;
create policy "Addressee can accept friend requests"
  on friendships for update
  to authenticated
  using (auth.uid() = addressee_id and status = 'pending')
  with check (auth.uid() = addressee_id and status = 'accepted');

-- with check can't see the OLD row, so an addressee could rewrite requester_id
-- while accepting. Column privileges close it: only status is updatable.
revoke update on friendships from authenticated;
grant update (status) on friendships to authenticated;

drop policy if exists "Parties can delete their friendships" on friendships;
create policy "Parties can delete their friendships"
  on friendships for delete
  to authenticated
  using (auth.uid() in (requester_id, addressee_id));

-- 3) free/busy RPC. Security definer instead of an events RLS policy on
-- purpose: RLS grants whole rows and PostgREST returns every column, so event
-- titles/locations would leak through the API no matter what the client
-- selects. This function's return type physically contains only date/start/end.
create or replace function get_friend_busy(friend uuid)
returns table (event_date date, event_time time, event_end_time time)
language sql
security definer
set search_path = public
as $$
  select e.event_date, e.event_time, e.event_end_time
  from events e
  where e.user_id = friend
    and exists (
      select 1 from friendships f
      where f.status = 'accepted'
        and ((f.requester_id = auth.uid() and f.addressee_id = friend)
          or (f.addressee_id = auth.uid() and f.requester_id = friend))
    )
  order by e.event_date, e.event_time;
$$;

revoke execute on function get_friend_busy(uuid) from public, anon;
grant execute on function get_friend_busy(uuid) to authenticated;
