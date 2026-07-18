// Turns get_friend_busy rows into a Set of "YYYY-MM-DD|H" keys for the
// availability grid. Kept free of supabase imports so it runs under plain node.

// ponytail: hour-granularity blocks — a 9:30-11:00 event marks 9, 10.
// Switch to 30-min keys if the grid ever needs half-hour resolution.
export function toBusySet(rows) {
  const busy = new Set();

  for (const row of rows ?? []) {
    if (!row.event_date || !row.event_time) continue;

    const startHour = Math.floor(parseHour(row.event_time));
    const end = row.event_end_time ? parseHour(row.event_end_time) : null;
    // no end time = assume a 1-hour block
    const endHour = end !== null && end > startHour ? Math.ceil(end) : startHour + 1;

    for (let hour = startHour; hour < endHour; hour += 1) {
      busy.add(`${row.event_date}|${hour}`);
    }
  }

  return busy;
}

function parseHour(time) {
  const [h, m] = time.split(":");
  return parseInt(h, 10) + parseInt(m, 10) / 60;
}
