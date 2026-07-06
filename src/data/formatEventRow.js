export function formatEventRow(row) {
  const dateObj = new Date(`${row.event_date}T${row.event_time}`);

  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    date: dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    time: dateObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    location: row.location,
    source: row.source,
  };
}
