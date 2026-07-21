-- Run manually in the Supabase SQL editor.
-- Adds the flag that gates the interest-selection onboarding screen
-- (see src/pages/Onboarding.jsx). New signups default to false and are
-- routed through onboarding once; existing users are backfilled to true
-- so they aren't retroactively interrupted by a screen they never signed
-- up to see.

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

update public.profiles
  set onboarding_completed = true
  where onboarding_completed = false;
