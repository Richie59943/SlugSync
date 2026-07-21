-- Adds a per-event display color, set from the add/edit event form's color
-- picker. Nullable — events without one fall back to the existing
-- category-derived color in getCategoryStyle (src/data/categoryStyles.js).
-- Run manually in the Supabase SQL editor; there is no migration runner.

alter table events
  add column if not exists color text;
