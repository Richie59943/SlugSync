create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  event_time time not null,
  location text,
  source text default 'Community',
  created_at timestamptz default now()
);

insert into events (title, event_date, event_time, location, source) values
  ('Campus Maker Night', '2026-07-08', '18:30', 'Downtown Studio', 'Community'),
  ('Community Launch Mixer', '2026-07-11', '20:00', 'River Hall', 'Community'),
  ('Remote Product Workshop', '2026-07-15', '10:00', 'Online', 'Community');

alter table events enable row level security;

create policy "Events are viewable by everyone"
  on events for select
  using (true);
