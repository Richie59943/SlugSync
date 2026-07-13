import { normalizeEventVisibility } from "./eventVisibility";

export function formatEventRow(row) {
  const dateObj = new Date(`${row.event_date}T${row.event_time}`);
  const endDateObj = row.event_end_time
    ? new Date(`${row.event_date}T${row.event_end_time}`)
    : null;
  const startTime = dateObj.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const endTime = endDateObj?.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    date: dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    time: endTime ? `${startTime} - ${endTime}` : startTime,
    eventDate: row.event_date,
    startTime: row.event_time?.slice(0, 5) ?? "",
    endTime: row.event_end_time?.slice(0, 5) ?? "",
    sortDate: row.event_date,
    sortTime: row.event_time,
    description: row.description,
    location: row.location,
    source: row.source,
    visibility: normalizeEventVisibility(row.visibility),
    // Not in the real events table yet — undefined until the optional
    // migration in src/lib/supabase/schema.sql lands. matchesPreferences
    // treats missing fields as "no match" rather than crashing.
    category: row.category ?? null,
    club: row.club ?? null,
    class_code: row.class_code ?? null,
  };
}
