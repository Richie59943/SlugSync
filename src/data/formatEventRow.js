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
    sortDate: row.event_date,
    sortTime: row.event_time,
    description: row.description,
    location: row.location,
    source: row.source,
  };
}
