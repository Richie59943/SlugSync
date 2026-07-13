const TEC_EVENTS_ENDPOINT =
  import.meta.env.VITE_UCSC_EVENTS_API ?? "/api/ucsc-events";

const MAX_PAGES = 5; // hard cap so a bad response can't trigger unbounded fetching

function stripHtml(html) {
  if (!html) return "";
  const withoutTags = html.replace(/<[^>]*>/g, " ");
  const textarea = document.createElement("textarea");
  textarea.innerHTML = withoutTags;
  return textarea.value.replace(/\s+/g, " ").trim();
}

function formatVenue(venue) {
  if (!venue || (!venue.venue && !venue.address)) return "Location TBA";
  if (venue.venue?.toLowerCase().includes("virtual")) return "Virtual Event";
  if (/^https?:\/\//i.test(venue.venue ?? "")) return "Virtual Event";
  const parts = [venue.venue, venue.city].filter(Boolean);
  return parts.join(", ") || venue.venue || "Location TBA";
}

function parseLocalDate(value) {
  if (!value) return null;
  const parsed = new Date(value.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeUcscEvent(raw) {
  const start = parseLocalDate(raw.start_date);
  if (!start) return null; 
  const end = parseLocalDate(raw.end_date);

  const sortDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(
    start.getDate(),
  ).padStart(2, "0")}`;
  const sortTime = `${String(start.getHours()).padStart(2, "0")}:${String(
    start.getMinutes(),
  ).padStart(2, "0")}`;
  const sortEndTime =
    end && end.getTime() !== start.getTime()
      ? `${String(end.getHours()).padStart(2, "0")}:${String(
          end.getMinutes(),
        ).padStart(2, "0")}`
      : null;

  const startLabel = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const endLabel =
    end && end.getTime() !== start.getTime()
      ? end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      : null;

  return {
    id: `ucsc-${raw.id}`,
    userId: null,
    title: stripHtml(raw.title) || "Untitled event",
    date: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    time: endLabel ? `${startLabel} - ${endLabel}` : startLabel,
    eventDate: sortDate,
    sortDate,
    sortTime,
    sortEndTime,
    location: formatVenue(raw.venue),
    description: stripHtml(raw.description).slice(0, 240),
    source: "UCSC Events",
    sourceUrl: raw.url ?? null,
    visibility: "community",
  };
}

export async function fetchUcscEvents({ days = 14, perPage = 25 } = {}) {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  const toDateParam = (d) => d.toISOString().slice(0, 10);

  const params = new URLSearchParams({
    start_date: toDateParam(startDate),
    end_date: toDateParam(endDate),
    per_page: String(perPage),
  });

  const events = [];
  let page = 1;
  let totalPages = 1;

  do {
    params.set("page", String(page));
    const response = await fetch(`${TEC_EVENTS_ENDPOINT}?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`UCSC Events API returned ${response.status}`);
    }

    const data = await response.json();
    for (const raw of data.events ?? []) {
      const normalized = normalizeUcscEvent(raw);
      if (normalized) events.push(normalized);
    }

    totalPages = data.total_pages ?? 1;
    page += 1;
  } while (page <= totalPages && page <= MAX_PAGES);

  return events;
}
