import React, { useEffect, useState } from "react";
import EventForm from "../components/EventForm";
import FilterNav from "../components/FilterNav";
import PreferencesFilter from "../components/PreferencesFilter";
import { communityEvents } from "../data/mockEvents";
import {
  createEvent,
  deleteEvent,
  fetchCommunityEvents,
  fetchEvents,
  updateEvent,
} from "../data/eventService";
import { formatEventRow } from "../data/formatEventRow";
import { fetchUcscEvents } from "../data/ucscEvents";
import { matchesPreferences } from "../data/matchesPreferences";
import { EVENT_VISIBILITY } from "../data/eventVisibility";
import { useUserPreferences } from "../hooks/useUserPreferences";
import { useQuickAdd } from "../context/QuickAddContext";
import { CATEGORY_PALETTE, getCategoryStyle } from "../data/categoryStyles";
import { firstNameFromEmail } from "../lib/displayName";

const WHO_OPTIONS = [
  { value: "all", label: "All" },
  { value: "community", label: "Community" },
  { value: "personal", label: "Personal" },
];

const WHEN_OPTIONS = [
  { value: "all", label: "Any date" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
];

const CATEGORY_ORDER = ["campus", "community", "clubs", "classes", "music", "outdoors"];

// ponytail: filter state lives in the query string so filtered views survive
// refresh and can be shared; swap for a router if pages ever need params too.
function useUrlFilter(key) {
  const [value, setValue] = useState(
    () => new URLSearchParams(window.location.search).get(key) || "all",
  );

  function update(next) {
    setValue(next);
    const params = new URLSearchParams(window.location.search);
    if (next === "all") params.delete(key);
    else params.set(key, next);
    const qs = params.toString();
    history.replaceState(
      null,
      "",
      window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash,
    );
  }

  return [value, update];
}

// ponytail: no geocoding — a raw Google Maps search on the location text is
// enough; virtual/unknown venues get plain text instead of a dead-end link
function locationMapsUrl(location) {
  if (!location || /virtual|online|tba|zoom/i.test(location)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

// stopPropagation keeps a card's location link from also opening the detail modal
function EventLocation({ location }) {
  if (!location) return null;
  const url = locationMapsUrl(location);
  if (!url) return <p>{location}</p>;
  return (
    <p>
      <a
        className="location-link"
        href={url}
        onClick={(clickEvent) => clickEvent.stopPropagation()}
        rel="noopener noreferrer"
        target="_blank"
      >
        {location} ↗
      </a>
    </p>
  );
}

function matchesWho(event, who, currentUserId) {
  if (who === "community") return event.visibility === EVENT_VISIBILITY.COMMUNITY;
  if (who === "personal") return currentUserId && event.userId === currentUserId;
  return true;
}

function matchesWhen(event, when) {
  if (when === "all") return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${event.eventDate}T00:00`);
  if (when === "today") return date.getTime() === today.getTime();
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return date >= today && date < weekEnd;
}

function matchesCategory(event, category) {
  if (category === "all") return true;
  const key = getCategoryStyle(event).key;
  if (category === "uncategorized") return key === null;
  return key === category;
}

function sortEvents(events) {
  return [...events].sort((a, b) => {
    const aDate = `${a.sortDate ?? ""}T${a.sortTime ?? "00:00"}`;
    const bDate = `${b.sortDate ?? ""}T${b.sortTime ?? "00:00"}`;
    return aDate.localeCompare(bDate);
  });
}

function toPersonalEvent(row) {
  return formatEventRow(row);
}

function toCommunityEvent(row) {
  return formatEventRow(row);
}

// Builds a createEvent() payload from a detected/community event so it can
// be copied into the signed-in user's own schedule.
function toScheduleInput(event) {
  return {
    title: event.title,
    description: event.description || `Imported from ${event.source}.`,
    eventDate: event.eventDate,
    startTime: event.sortTime,
    endTime: event.sortEndTime || null,
    location: event.location,
    source: event.source,
    visibility: EVENT_VISIBILITY.PRIVATE,
  };
}

function greetingForHour(hour) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Current month's day grid for the sidebar mini calendar, with the first
// real (sorted) event on each day attached for the dot indicator + click.
function buildMonthGrid(events, now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = new Date(year, month, 1).getDay();
  const todayDate = now.getDate();

  const eventByDay = new Map();
  events.forEach((event) => {
    if (!event.sortDate) return;
    const [y, m, d] = event.sortDate.split("-").map(Number);
    if (y === year && m === month + 1 && !eventByDay.has(d)) {
      eventByDay.set(d, event);
    }
  });

  const cells = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, isToday: day === todayDate, event: eventByDay.get(day) || null });
  }

  return {
    cells,
    monthLabel: now.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  };
}

const MINI_CAL_DOW = ["S", "M", "T", "W", "T", "F", "S"];

function Dashboard() {

  const [personalEvents, setPersonalEvents] = useState([]);
  const [publicEvents, setPublicEvents] = useState([]);
  const [ucscEvents, setUcscEvents] = useState([]);
  const [ucscError, setUcscError] = useState(null);

  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserEmail, setCurrentUserEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [message, setMessage] = useState(null);
  const [formError, setFormError] = useState(null);
  const [savingEvent, setSavingEvent] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState(null);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [deletingEventId, setDeletingEventId] = useState(null);
  const [addingEventId, setAddingEventId] = useState(null);
  const [signInPromptEvent, setSignInPromptEvent] = useState(null);
  const [eventToDetail, setEventToDetail] = useState(null);
  const [who, setWho] = useUrlFilter("who");
  const [when, setWhen] = useUrlFilter("when");
  const [category, setCategory] = useUrlFilter("category");
  const {
    preferences,
    status: preferencesStatus,
    error: preferencesError,
    savePreferences,
    clearPreferences,
  } = useUserPreferences();
  const { registerOpenAdd } = useQuickAdd();

  // Lets the shared nav's "+ Add event" button reuse this page's own modal.
  useEffect(() => registerOpenAdd(() => openModal()), [registerOpenAdd]);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      try {
        const { events, user } = await fetchEvents();
        if (cancelled) return;
        setCurrentUserId(user?.id ?? null);
        setCurrentUserEmail(user?.email ?? null);
        setPersonalEvents(events.map(toPersonalEvent));
      } catch (fetchError) {
        // ponytail: supabase reports "Auth session missing" when signed out —
        // that's a normal state, not a load failure
        if (!cancelled && !/auth session missing/i.test(fetchError.message)) {
          setLoadError(fetchError.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadEvents();

    // ponytail: mocks are only the fallback for Supabase projects that haven't
    // run events_visibility.sql yet — delete mockEvents.js once everyone has.
    fetchCommunityEvents()
      .then((rows) => {
        if (!cancelled) setPublicEvents(rows.map(toCommunityEvent));
      })
      .catch(() => {
        if (!cancelled) setPublicEvents(communityEvents);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadUcscEvents() {
      try {
        const events = await fetchUcscEvents();
        if (!cancelled) setUcscEvents(events);
      } catch (fetchError) {
        if (!cancelled) setUcscError(fetchError.message);
      }
    }

    loadUcscEvents();
    return () => {
      cancelled = true;
    };
  }, []);

  const personalEventIds = new Set(personalEvents.map((event) => event.id));
  const communityEventsWithoutDuplicates = publicEvents.filter(
    (event) => !personalEventIds.has(event.id),
  );
  const allEvents = [
    ...personalEvents,
    ...communityEventsWithoutDuplicates,
    ...ucscEvents,
  ];

  const visibleEvents = sortEvents(allEvents).filter(
    (event) =>
      matchesWho(event, who, currentUserId) &&
      matchesWhen(event, when) &&
      matchesPreferences(event, preferences) &&
      matchesCategory(event, category),
  );

  function openModal(event = null) {
    setMessage(null);
    setFormError(null);
    setEventToEdit(event);
    setIsAddModalOpen(true);
  }

  function closeModal() {
    setIsAddModalOpen(false);
    setEventToEdit(null);
    setFormError(null);
  }

  async function handleSubmitEvent(eventInput) {
    setSavingEvent(true);
    setFormError(null);

    try {
      if (eventToEdit) {
        const updated = toPersonalEvent(
          await updateEvent(eventToEdit.id, eventInput),
        );
        setPersonalEvents((events) =>
          events.map((event) => (event.id === updated.id ? updated : event)),
        );
        setPublicEvents((events) =>
          events.filter((event) => event.id !== updated.id),
        );
        setMessage(`Updated "${updated.title}".`);
      } else {
        const created = await createEvent(eventInput);
        setPersonalEvents((events) => [...events, toPersonalEvent(created)]);
        setCurrentUserId(created.user_id);
        setMessage(`Created "${created.title}".`);
      }
      closeModal();
    } catch (submitError) {
      setFormError(submitError.message);
    } finally {
      setSavingEvent(false);
    }
  }

  function isAlreadyScheduled(event) {
    return personalEvents.some(
      (personal) =>
        personal.title === event.title && personal.eventDate === event.eventDate,
    );
  }

  async function handleAddToSchedule(event) {
    if (!currentUserId) {
      setMessage(null);
      setSignInPromptEvent(event);
      return;
    }

    setMessage(null);
    setAddingEventId(event.id);

    try {
      const created = await createEvent(toScheduleInput(event));
      setPersonalEvents((events) => [...events, toPersonalEvent(created)]);
      setCurrentUserId(created.user_id);
      setMessage(`Added "${created.title}" to your schedule.`);
    } catch (addError) {
      setMessage(`Couldn't add to your schedule: ${addError.message}`);
    } finally {
      setAddingEventId(null);
    }
  }

  async function confirmDeleteEvent() {
    if (!eventToDelete) return;

    setDeletingEventId(eventToDelete.id);
    setMessage(null);

    try {
      await deleteEvent(eventToDelete.id);
      setPersonalEvents((events) =>
        events.filter((event) => event.id !== eventToDelete.id),
      );
      setPublicEvents((events) =>
        events.filter((event) => event.id !== eventToDelete.id),
      );
      setMessage(`Deleted "${eventToDelete.title}".`);
      setEventToDelete(null);
    } catch (deleteError) {
      setMessage(`Couldn't delete: ${deleteError.message}`);
    } finally {
      setDeletingEventId(null);
    }
  }

  // Shared action row (Edit/Delete for owned events, Add to schedule otherwise)
  // reused by both the featured card and the grid cards.
  function renderCardActions(event) {
    const isOwner = currentUserId && event.userId === currentUserId;
    const stop = (clickEvent) => clickEvent.stopPropagation();

    if (isOwner) {
      return (
        <div className="event-actions" onClick={stop}>
          <button
            className="edit-event-button"
            disabled={deletingEventId === event.id}
            onClick={() => openModal(event)}
            type="button"
          >
            Edit
          </button>
          <button
            className="delete-event-button"
            disabled={deletingEventId === event.id}
            onClick={() => {
              setMessage(null);
              setEventToDelete(event);
            }}
            type="button"
          >
            {deletingEventId === event.id ? "Deleting..." : "Delete"}
          </button>
        </div>
      );
    }

    return (
      <div className="event-actions" onClick={stop}>
        <button
          className="add-to-schedule-button"
          disabled={
            addingEventId === event.id ||
            (currentUserId && isAlreadyScheduled(event))
          }
          onClick={() => handleAddToSchedule(event)}
          type="button"
        >
          {currentUserId && isAlreadyScheduled(event)
            ? "Added to schedule ✓"
            : addingEventId === event.id
              ? "Adding..."
              : "+ Add to My Schedule"}
        </button>
      </div>
    );
  }

  const featuredEvent = visibleEvents[0] || null;
  const restEvents = featuredEvent ? visibleEvents.slice(1) : visibleEvents;

  const presentCategoryKeys = new Set(allEvents.map((event) => getCategoryStyle(event).key));
  const categoryFilters = [
    { key: "all", label: "All" },
    ...CATEGORY_ORDER.filter((key) => presentCategoryKeys.has(key)).map((key) => ({
      key,
      label: CATEGORY_PALETTE[key].label,
    })),
    ...(presentCategoryKeys.has(null) ? [{ key: "uncategorized", label: "Other" }] : []),
  ];

  const todaysEvents = visibleEvents.filter((event) => matchesWhen(event, "today"));
  const monthGrid = buildMonthGrid(allEvents);

  const sourceStatuses = [
    {
      key: "personal",
      name: "Your schedule",
      icon: "S",
      bg: "#eaf1ff",
      fg: "#2f5ecb",
      connected: Boolean(currentUserId),
      detail: currentUserId ? "Synced with your account" : "Sign in to sync",
    },
    {
      key: "community",
      name: "Community events",
      icon: "C",
      bg: "#f0ecff",
      fg: "#6b46e0",
      connected: true,
      detail: "Shared by other slugs",
    },
    {
      key: "ucsc",
      name: "UCSC Events",
      icon: "U",
      bg: "#e5f5f4",
      fg: "#16897f",
      connected: !ucscError,
      detail: ucscError ? "Couldn't connect" : "events.ucsc.edu",
    },
  ];

  const greeting = greetingForHour(new Date().getHours());
  const displayName = currentUserEmail ? firstNameFromEmail(currentUserEmail) : null;
  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <main className="dashboard">
      <section className="dashboard-hero" aria-labelledby="welcome-title">
        <p className="eyebrow">Santa Cruz, CA · {todayLabel}</p>
        <h1 id="welcome-title">
          {greeting}
          {displayName ? `, ${displayName}` : ""}.
        </h1>
        <p>
          {visibleEvents.length} event{visibleEvents.length === 1 ? "" : "s"} happening
          around campus and town — browse, filter by category, or add your own.
        </p>
      </section>

      {featuredEvent && (() => {
        const cat = getCategoryStyle(featuredEvent);
        return (
          <section className="featured-card" aria-label="Next up">
            <div className="featured-card-body">
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  background: cat.bg,
                  color: cat.text,
                  fontWeight: 700,
                  fontSize: 12,
                  padding: "5px 11px",
                  borderRadius: "var(--radius-pill)",
                  letterSpacing: "0.02em",
                  alignSelf: "flex-start",
                }}
              >
                <span
                  style={{ width: 6, height: 6, borderRadius: "50%", background: cat.dot }}
                />
                NEXT UP · {cat.label.toUpperCase()}
              </span>
              <h2>{featuredEvent.title}</h2>
              <div className="featured-card-meta">
                <span style={{ color: "var(--color-accent)" }}>
                  {featuredEvent.date} · {featuredEvent.time}
                </span>
                {featuredEvent.location && <span>{featuredEvent.location}</span>}
              </div>
              {featuredEvent.description && <p>{featuredEvent.description}</p>}
              <div className="featured-card-actions">{renderCardActions(featuredEvent)}</div>
            </div>
            <div className="featured-card-visual" style={{ background: cat.bg }}>
              <div
                className="featured-card-blob"
                style={{ width: 220, height: 220, background: cat.dot, top: -60, right: -60 }}
              />
              <div
                className="featured-card-blob"
                style={{ width: 130, height: 130, background: "var(--color-accent)", bottom: -40, left: -30, opacity: 0.35 }}
              />
            </div>
          </section>
        );
      })()}

      {categoryFilters.length > 1 && (
        <div className="category-scroll">
          {categoryFilters.map((c) => {
            const active = category === c.key;
            const palette =
              c.key !== "all" && c.key !== "uncategorized" ? CATEGORY_PALETTE[c.key] : null;
            return (
              <button
                key={c.key}
                type="button"
                className={`pill${active ? " is-active" : ""}`}
                style={
                  active && palette
                    ? { background: palette.bg, borderColor: "transparent", color: palette.text }
                    : undefined
                }
                onClick={() => setCategory(c.key)}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ponytail: tabs reuse the existing `who` url-filter state, so the
          selected view still survives refresh and shareable links */}
      <div className="view-tabs" role="tablist" aria-label="Event view">
        {WHO_OPTIONS.map((opt) => (
          <button
            aria-selected={who === opt.value}
            className={`view-tab${who === opt.value ? " is-active" : ""}`}
            key={opt.value}
            onClick={() => setWho(opt.value)}
            role="tab"
            type="button"
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="filter-bar">
        <FilterNav
          label="Filter by date"
          options={WHEN_OPTIONS}
          value={when}
          onChange={setWhen}
        />
        <PreferencesFilter
          error={preferencesError}
          events={allEvents}
          onClear={clearPreferences}
          onSave={savePreferences}
          preferences={preferences}
          status={preferencesStatus}
          userId={currentUserId}
        />
      </div>

      {message && <p className="event-message event-message-success">{message}</p>}
      {loadError && (
        <p className="event-message event-message-error">
          Couldn't load your events: {loadError}
        </p>
      )}
      {ucscError && (
        <p className="event-message event-message-error">
          Couldn't load UCSC events: {ucscError}
        </p>
      )}
      {!loading && !loadError && !currentUserId && (
        <p className="event-message event-message-error">
          Sign in to create and view your personal events.
        </p>
      )}

      <div className="dashboard-layout">
        <div>
          <div className="dashboard-section-header">
            <h3>Upcoming events</h3>
            <span>{visibleEvents.length} event{visibleEvents.length === 1 ? "" : "s"}</span>
          </div>

          <section className="event-grid" aria-label="Events">
            {loading && <p className="empty-state">Loading events…</p>}
            {restEvents.map((event) => {
              const cat = getCategoryStyle(event);
              return (
                <article
                  className="event-card"
                  key={event.id}
                  onClick={() => setEventToDetail(event)}
                  onKeyDown={(keyEvent) => {
                    // ignore Enter/Space bubbling up from the card's inner buttons/links
                    if (keyEvent.target !== keyEvent.currentTarget) return;
                    if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                      keyEvent.preventDefault();
                      setEventToDetail(event);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="event-card-media" style={{ background: cat.bg }}>
                    <div
                      className="event-card-media-blob"
                      style={{ background: cat.dot, opacity: 0.18 }}
                    />
                    <span className="event-card-category" style={{ color: cat.text }}>
                      <span className="event-card-category-dot" style={{ background: cat.dot }} />
                      {cat.label}
                    </span>
                    {event.date && <span className="event-card-date-badge">{event.date}</span>}
                  </div>
                  <div className="event-card-body">
                    <div className="event-card-header">
                      <span
                        className={`badge badge-${
                          event.visibility === EVENT_VISIBILITY.COMMUNITY
                            ? "community"
                            : "private"
                        }`}
                      >
                        {event.visibility === EVENT_VISIBILITY.COMMUNITY
                          ? "Community"
                          : "Private"}
                      </span>
                      <span className="event-source">{event.source}</span>
                    </div>
                    <h3>{event.title}</h3>
                    <p className="event-when">{event.time}</p>
                    <EventLocation location={event.location} />
                    {event.description && (
                      <p className="event-description">{event.description}</p>
                    )}
                    {renderCardActions(event)}
                  </div>
                </article>
              );
            })}
            {!loading && visibleEvents.length === 0 && (
              <p className="empty-state">No events match your current filters.</p>
            )}
          </section>
        </div>

        <aside className="dashboard-sidebar">
          <div className="panel">
            <div className="sidebar-card-title">{monthGrid.monthLabel}</div>
            <div className="mini-calendar-grid">
              {MINI_CAL_DOW.map((d, i) => (
                <div className="mini-calendar-dow" key={`dow-${i}`}>
                  {d}
                </div>
              ))}
              {monthGrid.cells.map((cell, i) => {
                if (!cell) return <div key={`blank-${i}`} />;
                const cat = cell.event ? getCategoryStyle(cell.event) : null;
                return (
                  <button
                    type="button"
                    key={cell.day}
                    className={`mini-calendar-cell${cell.isToday ? " is-today" : ""}${
                      cell.event ? " is-clickable" : ""
                    }`}
                    disabled={!cell.event}
                    onClick={() => {
                      window.location.hash = "#/calendar";
                    }}
                    title={cell.event ? cell.event.title : undefined}
                  >
                    {cell.day}
                    {cat && (
                      <span
                        className="mini-calendar-dot"
                        style={{ background: cell.isToday ? "#ffffff" : cat.dot }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="panel">
            <div className="sidebar-card-title">Today's schedule</div>
            {todaysEvents.length === 0 && (
              <p className="empty-state" style={{ textAlign: "left", margin: 0 }}>
                Nothing scheduled today.
              </p>
            )}
            {todaysEvents.map((event) => {
              const cat = getCategoryStyle(event);
              return (
                <div className="schedule-row" key={event.id}>
                  <span className="schedule-time">{event.time}</span>
                  <div className="schedule-detail" style={{ borderLeftColor: cat.dot }}>
                    <strong>{event.title}</strong>
                    {event.location && <span>{event.location}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="panel">
            <div className="sidebar-card-title">Connected sources</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {sourceStatuses.map((source) => (
                <div className="source-status-row" key={source.key}>
                  <span
                    className="source-status-icon"
                    style={{ background: source.bg, color: source.fg }}
                  >
                    {source.icon}
                  </span>
                  <span className="source-status-name">
                    {source.name}
                    <br />
                    <span style={{ fontSize: 11, color: "var(--color-text-muted)", fontWeight: 500 }}>
                      {source.detail}
                    </span>
                  </span>
                  <span
                    className="source-status-badge"
                    style={
                      source.connected
                        ? { background: "#e8f6ee", color: "#1f8a52" }
                        : { background: "#f2f3f6", color: "var(--color-text-secondary)" }
                    }
                  >
                    {source.connected ? "Connected" : source.key === "personal" ? "Sign in" : "Error"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <section className="source-grid" aria-label="Future event sources">
        <article className="source-card source-instagram">
          <p className="eyebrow">Future source</p>
          <h2>Instagram events</h2>
          <p>
            Placeholder for events discovered from posts, stories, or profile
            activity once source integrations are added.
          </p>
        </article>
        <article className="source-card source-discord">
          <p className="eyebrow">Future source</p>
          <h2>Discord events</h2>
          <p>
            Placeholder for events collected from servers, channels, and
            community announcements in a later phase.
          </p>
        </article>
      </section>

      {isAddModalOpen && (
        <div
          aria-labelledby="add-event-title"
          aria-modal="true"
          className="modal-backdrop"
          role="dialog"
        >
          <div className="confirm-dialog event-form-dialog">
            <p className="eyebrow">{eventToEdit ? "Edit event" : "New event"}</p>
            <h2 id="add-event-title">
              {eventToEdit ? eventToEdit.title : "Add Event"}
            </h2>
            <EventForm
              error={formError}
              initialData={eventToEdit}
              isLoading={savingEvent}
              mode={eventToEdit ? "edit" : "add"}
              onCancel={closeModal}
              onSubmit={handleSubmitEvent}
            />
          </div>
        </div>
      )}

      {eventToDelete && (
        <div
          aria-labelledby="delete-event-title"
          aria-modal="true"
          className="modal-backdrop"
          role="dialog"
        >
          <div className="confirm-dialog">
            <p className="eyebrow">Delete event</p>
            <h2 id="delete-event-title">{eventToDelete.title}</h2>
            <p>This will permanently remove the event from your schedule.</p>
            <div className="confirm-actions">
              <button
                className="btn-secondary"
                disabled={deletingEventId === eventToDelete.id}
                onClick={() => setEventToDelete(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="btn-danger"
                disabled={deletingEventId === eventToDelete.id}
                onClick={confirmDeleteEvent}
                type="button"
              >
                {deletingEventId === eventToDelete.id
                  ? "Deleting..."
                  : "Confirm delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {eventToDetail && (
        <div
          aria-labelledby="event-detail-title"
          aria-modal="true"
          className="modal-backdrop"
          role="dialog"
        >
          <div className="confirm-dialog">
            <div className="event-card-header">
              <span
                className={`badge badge-${
                  eventToDetail.visibility === EVENT_VISIBILITY.COMMUNITY
                    ? "community"
                    : "private"
                }`}
              >
                {eventToDetail.visibility === EVENT_VISIBILITY.COMMUNITY
                  ? "Community"
                  : "Private"}
              </span>
              <span className="event-source">{eventToDetail.source}</span>
            </div>
            <h2 id="event-detail-title">{eventToDetail.title}</h2>
            <p className="event-when">
              {eventToDetail.date} · {eventToDetail.time}
            </p>
            <EventLocation location={eventToDetail.location} />
            <p className="event-detail-description">
              {eventToDetail.description || "No description provided."}
            </p>
            <div className="confirm-actions">
              <button
                className="btn-secondary"
                onClick={() => setEventToDetail(null)}
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {signInPromptEvent && (
        <div
          aria-labelledby="sign-in-prompt-title"
          aria-modal="true"
          className="modal-backdrop"
          role="dialog"
        >
          <div className="confirm-dialog">
            <p className="eyebrow">Sign in required</p>
            <h2 id="sign-in-prompt-title">{signInPromptEvent.title}</h2>
            <p>Sign in to add this event to your personal schedule.</p>
            <div className="confirm-actions">
              <button
                className="btn-secondary"
                onClick={() => setSignInPromptEvent(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  window.location.hash = "#/profile";
                  setSignInPromptEvent(null);
                }}
                type="button"
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default Dashboard;
