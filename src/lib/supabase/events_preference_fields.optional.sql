-- Sprint 2.4 — OPTIONAL. Do NOT run this without team sign-off.
--
-- The dashboard currently gets category/club/class_code from mock community
-- events only (see src/data/mockEvents.js). Personal events already read
-- these columns defensively (formatEventRow.js falls back to null), so
-- running this migration is safe and requires no further code changes —
-- but it does grow the real events table's public write surface, so it's
-- kept separate from the required user_preferences migration above.
--
-- Run this only once the team decides real events should carry these
-- fields (e.g. when event creation/import starts populating them).

alter table events
  add column if not exists category text;

alter table events
  add column if not exists club text;

alter table events
  add column if not exists class_code text;
