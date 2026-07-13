import React, { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import EventForm from "../components/EventForm";
import {
  createEvent,
  deleteEvent,
  fetchEvents,
  updateEvent,
} from "../data/eventService";
import { EVENT_VISIBILITY } from "../data/eventVisibility";
import { formatEventRow } from "../data/formatEventRow";

function toCalendarEvent(event) {
  const hasTime = Boolean(event.startTime);
  const calendarEvent = {
    id: event.id,
    title: event.title,
    color:
      event.visibility === EVENT_VISIBILITY.COMMUNITY ? "#0f766e" : "#4f46e5",
    extendedProps: {
      eventData: event,
      location: event.location,
      visibility: event.visibility,
    },
  };

  if (hasTime) {
    calendarEvent.start = `${event.eventDate}T${event.startTime}`;
    if (event.endTime) {
      calendarEvent.end = `${event.eventDate}T${event.endTime}`;
    }
  } else {
    calendarEvent.date = event.eventDate;
  }

  return calendarEvent;
}

function todayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function Calendar() {
  const [events, setEvents] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [message, setMessage] = useState(null);
  const [formError, setFormError] = useState(null);
  const [savingEvent, setSavingEvent] = useState(false);
  const [eventToEdit, setEventToEdit] = useState(null);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [deletingEventId, setDeletingEventId] = useState(null);
  const [missingFields, setMissingFields] = useState([]);

  // AI describe box
  const [showAiBox, setShowAiBox] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const calendarEvents = useMemo(() => events.map(toCalendarEvent), [events]);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      setLoading(true);
      setLoadError(null);

      try {
        const { events: rows, user } = await fetchEvents();
        if (cancelled) return;
        setCurrentUserId(user?.id ?? null);
        setEvents(rows.map(formatEventRow));
      } catch (fetchError) {
        if (!cancelled && !/auth session missing/i.test(fetchError.message)) {
          setLoadError(fetchError.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadEvents();

    return () => {
      cancelled = true;
    };
  }, []);

  function openAiBox() {
    setShowAiBox(true);
    setAiText("");
    setAiError("");
    setMessage(null);
  }

  function closeAiBox() {
    setShowAiBox(false);
    setAiText("");
    setAiError("");
  }

  function openAddForm() {
    closeAiBox();
    setMissingFields([]);
    setEventToEdit({});
    setFormError(null);
    setMessage(null);
  }

  function closeForm() {
    setEventToEdit(null);
    setFormError(null);
    setMissingFields([]);
  }

  async function handleAiParse() {
    if (!aiText.trim()) {
      setAiError("Describe your event first.");
      return;
    }

    setAiLoading(true);
    setAiError("");

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-event`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text: aiText, today: todayString() }),
        },
      );

      const parsed = await res.json();

      if (!res.ok) {
        console.error("Edge function error:", parsed);
        setAiError(parsed.error || `Request failed (${res.status}).`);
        return;
      }

      if (parsed.error) {
        setAiError("Couldn't find an event in that text. Try being more specific.");
        return;
      }

      const gaps = [];
      if (!parsed.title) gaps.push("title");
      if (!parsed.date) gaps.push("eventDate");
      if (!parsed.startTime) gaps.push("startTime");

      // Map the AI's shape onto the shape EventForm expects
      setMissingFields(gaps);
      setEventToEdit({
        title: parsed.title || "",
        description: "",
        eventDate: parsed.date || "",
        startTime: parsed.startTime || "",
        endTime: parsed.endTime || "",
        location: parsed.location || "",
      });
      setFormError(null);
      closeAiBox();
    } catch (err) {
      console.error(err);
      setAiError("Request failed. Check your connection.");
    } finally {
      setAiLoading(false);
    }
  }

  function handleEventClick(clickInfo) {
    closeAiBox();
    setMissingFields([]);
    setEventToEdit(clickInfo.event.extendedProps.eventData);
    setFormError(null);
    setMessage(null);
  }

  async function handleSubmitEvent(eventInput) {
    setSavingEvent(true);
    setFormError(null);

    try {
      if (eventToEdit?.id) {
        const updated = formatEventRow(
          await updateEvent(eventToEdit.id, eventInput),
        );
        setEvents((currentEvents) =>
          currentEvents.map((event) =>
            event.id === updated.id ? updated : event,
          ),
        );
        setMessage(`Updated "${updated.title}".`);
      } else {
        const created = formatEventRow(await createEvent(eventInput));
        setEvents((currentEvents) => [...currentEvents, created]);
        setCurrentUserId(created.userId);
        setMessage(`Created "${created.title}".`);
      }
      closeForm();
    } catch (submitError) {
      setFormError(submitError.message);
    } finally {
      setSavingEvent(false);
    }
  }

  async function confirmDeleteEvent() {
    if (!eventToDelete) return;

    setDeletingEventId(eventToDelete.id);
    setMessage(null);

    try {
      await deleteEvent(eventToDelete.id);
      setEvents((currentEvents) =>
        currentEvents.filter((event) => event.id !== eventToDelete.id),
      );
      setMessage(`Deleted "${eventToDelete.title}".`);
      setEventToDelete(null);
      closeForm();
    } catch (deleteError) {
      setMessage(`Couldn't delete: ${deleteError.message}`);
    } finally {
      setDeletingEventId(null);
    }
  }

  return (
    <main className="dashboard">
      <style>{`
        .fc-event { cursor: pointer; transition: opacity 0.15s; }
        .fc-event:hover { opacity: 0.75; }
      `}</style>

      <section className="welcome-section">
        <div>
          <p className="eyebrow">Event calendar</p>
          <h1>Your calendar</h1>
          <p>Describe an event in plain text, or click an event to edit it.</p>
        </div>
        {!showAiBox && (
          <button className="create-button" onClick={openAiBox} type="button">
            + Add event
          </button>
        )}
      </section>

      {showAiBox && (
        <section className="panel ai-describe-box">
          <label>
            Describe an event
            <textarea
              autoFocus
              onChange={(e) => {
                setAiText(e.target.value);
                setAiError("");
              }}
              placeholder="surf club meeting next Tuesday 5pm at Main Beach"
              rows={2}
              value={aiText}
            />
          </label>

          {aiError && <p className="event-message event-message-error">{aiError}</p>}

          <div className="ai-describe-actions">
            <button
              className="btn-primary"
              disabled={aiLoading}
              onClick={handleAiParse}
              type="button"
            >
              {aiLoading ? "Thinking..." : "Add with AI"}
            </button>
            <button className="btn-link" onClick={openAddForm} type="button">
              enter manually
            </button>
            <button className="btn-link" onClick={closeAiBox} type="button">
              cancel
            </button>
          </div>
</section>
      )}

      {message && <p className="event-message event-message-success">{message}</p>}
      {loadError && (
        <p className="event-message event-message-error">
          Couldn't load your events: {loadError}
        </p>
      )}
      {!loading && !loadError && !currentUserId && (
        <p className="event-message event-message-error">
          Sign in to create and view your calendar events.
        </p>
      )}

      <section className="calendar-panel">
        {loading ? (
          <p className="empty-state">Loading calendar...</p>
        ) : (
          <FullCalendar
            eventClick={handleEventClick}
            events={calendarEvents}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            height="auto"
            initialView="dayGridMonth"
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          />
        )}
      </section>

      {eventToEdit && (
        <div
          aria-labelledby="calendar-event-form-title"
          aria-modal="true"
          className="modal-backdrop"
          role="dialog"
        >
          <div className="confirm-dialog event-form-dialog">
            <p className="eyebrow">{eventToEdit.id ? "Edit event" : "Review event"}</p>
            <h2 id="calendar-event-form-title">
              {eventToEdit.id ? eventToEdit.title : "Add Event"}
            </h2>
            <EventForm
              error={formError}
              initialData={eventToEdit}
              isLoading={savingEvent}
              missingFields={missingFields}
              mode={eventToEdit.id ? "edit" : "add"}
              onCancel={closeForm}
              onSubmit={handleSubmitEvent}
            />
            {eventToEdit.id && (
              <button
                className="calendar-delete-button"
                disabled={deletingEventId === eventToEdit.id || savingEvent}
                onClick={() => setEventToDelete(eventToEdit)}
                type="button"
              >
                Delete event
              </button>
            )}
          </div>
        </div>
      )}

      {eventToDelete && (
        <div
          aria-labelledby="calendar-delete-event-title"
          aria-modal="true"
          className="modal-backdrop"
          role="dialog"
        >
          <div className="confirm-dialog">
            <p className="eyebrow">Delete event</p>
            <h2 id="calendar-delete-event-title">{eventToDelete.title}</h2>
            <p>This will permanently remove the event from your calendar.</p>
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
    </main>
  );
}

export default Calendar;
