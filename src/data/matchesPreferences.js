// Reusable preference filter. Works on both mock events and future Supabase
// events since it only reads three plain fields and never crashes on
// missing/null values.

function normalize(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function toNormalizedSet(values) {
  return new Set((values || []).map(normalize).filter(Boolean));
}

// preferences: { clubs: string[], classes: string[], categories: string[] }
export function matchesPreferences(event, preferences) {
  if (!event || !preferences) return true;

  const clubs = toNormalizedSet(preferences.clubs);
  const classes = toNormalizedSet(preferences.classes);
  const categories = toNormalizedSet(preferences.categories);

  // No preferences selected at all -> show everything.
  if (clubs.size === 0 && classes.size === 0 && categories.size === 0) {
    return true;
  }

  const eventCategory = normalize(event.category);
  const eventClub = normalize(event.club);
  const eventClass = normalize(event.class_code ?? event.class);

  return (
    (categories.size > 0 && categories.has(eventCategory)) ||
    (clubs.size > 0 && clubs.has(eventClub)) ||
    (classes.size > 0 && classes.has(eventClass))
  );
}
