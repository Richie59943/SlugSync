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

function Dashboard() {

  const [personalEvents, setPersonalEvents] = useState([]);
  const [publicEvents, setPublicEvents] = useState([]);
  const [ucscEvents, setUcscEvents] = useState([]);
  const [ucscError, setUcscError] = useState(null);

  const [currentUserId, setCurrentUserId] = useState(null);
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
  const [who, setWho] = useUrlFilter("who");
  const [when, setWhen] = useUrlFilter("when");
  const {
    preferences,
    status: preferencesStatus,
    error: preferencesError,
    savePreferences,
    clearPreferences,
  } = useUserPreferences();

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      try {
        const { events, user } = await fetchEvents();
        if (cancelled) return;
        setCurrentUserId(user?.id ?? null);
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
      matchesPreferences(event, preferences),
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

  return (
    <main className="dashboard">
      <section className="welcome-section" aria-labelledby="welcome-title">
        <div>
          <p className="eyebrow">Santa Cruz, CA</p>
          <h1 id="welcome-title">Your event dashboard.</h1>
          <p>
            Browse community events happening around Santa Cruz alongside your
            personal schedule, or add one of your own.
          </p>
        </div>
        <button className="create-button" onClick={() => openModal()} type="button">
          + Add Event
        </button>
      </section>

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

      <section className="event-grid" aria-label="Events">
        {loading && <p className="empty-state">Loading events…</p>}
        {visibleEvents.map((event) => (
          <article className="event-card" key={event.id}>
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
            <p className="event-when">
              {event.date} · {event.time}
            </p>
            <p>{event.location}</p>
            {event.description && <p>{event.description}</p>}
            {currentUserId && event.userId === currentUserId && (
              <div className="event-actions">
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
            )}
            {!(currentUserId && event.userId === currentUserId) && (
              <div className="event-actions">
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
            )}
          </article>
        ))}
        {!loading && visibleEvents.length === 0 && (
          <p className="empty-state">No events match your current filters.</p>
        )}
      </section>

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
