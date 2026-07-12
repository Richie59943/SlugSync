-- Adds personal/community visibility to events so the dashboard can filter
-- server-side. Run in the Supabase SQL editor (safe to re-run).

alter table events
  add column if not exists visibility text not null default 'personal'
  check (visibility in ('personal', 'public'));

-- Seeded community rows (schema.sql) have no owner — mark them public.
update events set visibility = 'public' where user_id is null;

drop policy if exists "Public events are viewable by everyone" on events;
create policy "Public events are viewable by everyone"
  on events for select
  to anon, authenticated
  using (visibility = 'public');