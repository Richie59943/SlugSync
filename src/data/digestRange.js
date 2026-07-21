// Pure date-range logic for the Dashboard's Daily digest panel. Kept free of
// Supabase imports so it runs under plain node, same as busyGrid.js.

export const DIGEST_RANGES = {
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
};

export const DIGEST_RANGE_OPTIONS = [
  { value: DIGEST_RANGES.DAILY, label: "Daily", heading: "Daily digest", period: "today" },
  { value: DIGEST_RANGES.WEEKLY, label: "Weekly", heading: "Weekly digest", period: "this week" },
  { value: DIGEST_RANGES.MONTHLY, label: "Monthly", heading: "Monthly digest", period: "this month" },
];

export function digestHeading(range) {
  return DIGEST_RANGE_OPTIONS.find((option) => option.value === range)?.heading ?? "Daily digest";
}

export function digestPeriodLabel(range) {
  return DIGEST_RANGE_OPTIONS.find((option) => option.value === range)?.period ?? "today";
}

export function todayString(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayWeekday(now = new Date()) {
  return now.toLocaleDateString("en-US", { weekday: "long" });
}

function startOfDay(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

// First moment of next month — an exclusive upper bound covering the rest of
// the current calendar month, regardless of which day `date` falls on.
function endOfMonthExclusive(date) {
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  end.setHours(0, 0, 0, 0);
  return end;
}

// Half-open [start, end) window anchored on `now`, so an event exactly at
// the boundary only ever belongs to one range.
export function getRangeWindow(range, now = new Date()) {
  const start = startOfDay(now);
  let end;

  if (range === DIGEST_RANGES.WEEKLY) {
    end = new Date(start);
    end.setDate(end.getDate() + 7);
  } else if (range === DIGEST_RANGES.MONTHLY) {
    end = endOfMonthExclusive(start);
  } else {
    end = new Date(start);
    end.setDate(end.getDate() + 1);
  }

  return { start, end };
}

export function isEventInRange(event, range, now = new Date()) {
  if (!event?.eventDate) return false;
  const { start, end } = getRangeWindow(range, now);
  const eventDate = new Date(`${event.eventDate}T00:00`);
  return eventDate >= start && eventDate < end;
}

export function filterEventsInRange(events, range, now = new Date()) {
  return (events ?? []).filter((event) => isEventInRange(event, range, now));
}

// Buckets already-filtered weekly events into the 7 days of the rolling
// weekly window (today → today+6), so the weekly grid always shows 7
// columns — including empty ones — regardless of which weekday "today" is.
export function groupEventsByWeekday(events, now = new Date()) {
  const { start } = getRangeWindow(DIGEST_RANGES.WEEKLY, now);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    days.push({
      dateKey: todayString(date),
      label: date.toLocaleDateString("en-US", { weekday: "long" }),
      shortDate: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      events: [],
    });
  }

  const byDateKey = Object.fromEntries(days.map((day) => [day.dateKey, day]));
  (events ?? []).forEach((event) => {
    byDateKey[event.eventDate]?.events.push(event);
  });

  return days;
}
