create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  description text,
  event_date date not null,
  event_time time not null,
  event_end_time time,
  location text,
  source text default 'manual',
  created_at timestamptz default now()
);

alter table events
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table events
  add column if not exists description text;

alter table events
  add column if not exists event_end_time time;

insert into events (title, event_date, event_time, location, source) values
  ('Campus Maker Night', '2026-07-08', '18:30', 'Downtown Studio', 'Community'),
  ('Community Launch Mixer', '2026-07-11', '20:00', 'River Hall', 'Community'),
  ('Remote Product Workshop', '2026-07-15', '10:00', 'Online', 'Community');

alter table events enable row level security;

drop policy if exists "Events are viewable by everyone" on events;
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

drop policy if exists "Events can be deleted by everyone" on events;
drop policy if exists "Users can delete their own events" on events;
create policy "Users can delete their own events"
  on events for delete
  to authenticated
  using (auth.uid() = user_id);
