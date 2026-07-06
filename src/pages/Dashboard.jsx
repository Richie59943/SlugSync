import React, { useEffect, useState } from "react";
import { calendarDays, calendarPreview } from "../data/mockEvents";
import {
  createEvent,
  deleteEvent,
  fetchEvents,
  updateEvent,
} from "../data/eventService";
import { formatEventRow } from "../data/formatEventRow";


const emptyEventForm = {
  title: "",
  description: "",
  eventDate: "",
  startTime: "",
  endTime: "",
  location: "",
  source: "manual",
};

function sortEvents(events) {
  return [...events].sort((a, b) => {
    const aDate = `${a.sortDate ?? ""}T${a.sortTime ?? "00:00"}`;
    const bDate = `${b.sortDate ?? ""}T${b.sortTime ?? "00:00"}`;
    return aDate.localeCompare(bDate);
  });
}

function eventToForm(event) {
  return {
    title: event.title ?? "",
    description: event.description ?? "",
    eventDate: event.eventDate ?? "",
    startTime: event.startTime ?? "",
    endTime: event.endTime ?? "",
    location: event.location ?? "",
    source: event.source ?? "manual",
  };
}

function Dashboard() {
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [eventForm, setEventForm] = useState(emptyEventForm);
  const [formErrors, setFormErrors] = useState({});
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [createSuccess, setCreateSuccess] = useState(null);
  const [updateError, setUpdateError] = useState(null);
  const [updateSuccess, setUpdateSuccess] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [deleteSuccess, setDeleteSuccess] = useState(null);
  const [deletingEventId, setDeletingEventId] = useState(null);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [eventToEdit, setEventToEdit] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      try {
        const { events, user } = await fetchEvents();

        if (cancelled) return;

        setCurrentUserId(user?.id ?? null);
        setUpcomingEvents(events.map(formatEventRow));
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadEvents();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleEventField(field) {
    return (event) => {
      setEventForm((form) => ({ ...form, [field]: event.target.value }));
      setFormErrors((errors) => ({ ...errors, [field]: null }));
    };
  }

  function validateEventForm() {
    const errors = {};

    if (!eventForm.title.trim()) {
      errors.title = "Event title is required.";
    }

    if (!eventForm.eventDate) {
      errors.eventDate = "Date is required.";
    }

    if (!eventForm.startTime) {
      errors.startTime = "Start time is required.";
    }

    if (
      eventForm.startTime &&
      eventForm.endTime &&
      eventForm.endTime <= eventForm.startTime
    ) {
      errors.endTime = "End time must be after the start time.";
    }

    return errors;
  }

  function clearEventMessages() {
    setCreateError(null);
    setCreateSuccess(null);
    setUpdateError(null);
    setUpdateSuccess(null);
    setDeleteError(null);
    setDeleteSuccess(null);
  }

  async function handleSubmitEvent(event) {
    event.preventDefault();

    const validationErrors = validateEventForm();
    setFormErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setSavingEvent(true);
    clearEventMessages();

    try {
      const eventInput = {
        ...eventForm,
        title: eventForm.title.trim(),
        description: eventForm.description.trim(),
        location: eventForm.location.trim(),
      };

      if (eventToEdit) {
        const updatedEvent = await updateEvent(eventToEdit.id, eventInput);
        const formattedEvent = formatEventRow(updatedEvent);

        setUpcomingEvents((events) =>
          sortEvents(
            events.map((currentEvent) =>
              currentEvent.id === formattedEvent.id ? formattedEvent : currentEvent,
            ),
          ),
        );
        setUpdateSuccess(`Updated "${updatedEvent.title}".`);
        setEventToEdit(null);
      } else {
        const createdEvent = await createEvent(eventInput);
        const formattedEvent = formatEventRow(createdEvent);

        setUpcomingEvents((events) => sortEvents([...events, formattedEvent]));
        setCurrentUserId(createdEvent.user_id);
        setCreateSuccess(`Created "${createdEvent.title}".`);
        setIsAddModalOpen(false);
      }

      setEventForm(emptyEventForm);
      setFormErrors({});
    } catch (submitEventError) {
      if (eventToEdit) {
        setUpdateError(submitEventError.message);
      } else {
        setCreateError(submitEventError.message);
      }
    } finally {
      setSavingEvent(false);
    }
  }

  async function confirmDeleteEvent() {
    if (!eventToDelete) return;

    setDeletingEventId(eventToDelete.id);
    setDeleteError(null);
    setDeleteSuccess(null);

    try {
      await deleteEvent(eventToDelete.id);
      setUpcomingEvents((events) =>
        events.filter((currentEvent) => currentEvent.id !== eventToDelete.id),
      );
      setDeleteSuccess(`Deleted "${eventToDelete.title}".`);
      setEventToDelete(null);
    } catch (deleteEventError) {
      setDeleteError(deleteEventError.message);
    } finally {
      setDeletingEventId(null);
    }
  }

  return (
    <div className="app-shell">
      <main className="dashboard">
        <section className="welcome-section" aria-labelledby="welcome-title">
          <div>
            <p className="eyebrow">Event calendar</p>
            <h1 id="welcome-title">Welcome to your event dashboard.</h1>
            <p>
              Browse upcoming events happening around campus. Instagram and
              Discord source cards are ready for future integrations.
            </p>
          </div>
          <button
            className="create-button"
            onClick={() => {
              clearEventMessages();
              setEventForm(emptyEventForm);
              setFormErrors({});
              setEventToEdit(null);
              setIsAddModalOpen(true);
            }}
            type="button"
          >
            Add Event
          </button>
          <div
            className="welcome-stat"
            aria-label={`${upcomingEvents.length} events this week`}
          >
            <strong>{upcomingEvents.length}</strong>
            <span>events this week</span>
          </div>
        </section>
        <section className="dashboard-grid" aria-label="Dashboard overview">
          <article className="panel calendar-preview">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Preview</p>
                <h2>July calendar</h2>
              </div>
              <span>2026</span>
            </div>
            <div className="calendar-grid">
              {calendarDays.map((day) => (
                <div className="calendar-label" key={day}>
                  {day}
                </div>
              ))}
              {calendarPreview.map(({ day, hasEvent, isToday }) => (
                <div
                  className={`calendar-day${hasEvent ? " has-event" : ""}${
                    isToday ? " is-today" : ""
                  }`}
                  key={day}
                >
                  <span>{day}</span>
                </div>
              ))}
            </div>
          </article>
          <article className="panel upcoming-events">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Next up</p>
                <h2>Upcoming events</h2>
              </div>
              <span>{loading ? "Loading…" : "Live"}</span>
            </div>
            {error && <p className="empty-state">Couldn't load events: {error}</p>}
            {deleteSuccess && (
              <p className="event-message event-message-success">{deleteSuccess}</p>
            )}
            {createSuccess && (
              <p className="event-message event-message-success">{createSuccess}</p>
            )}
            {updateSuccess && (
              <p className="event-message event-message-success">{updateSuccess}</p>
            )}
            {deleteError && (
              <p className="event-message event-message-error">{deleteError}</p>
            )}
            {!currentUserId && !loading && !error && (
              <p className="event-message event-message-error">
                Sign in to create and view your events.
              </p>
            )}
            {!error && !loading && upcomingEvents.length === 0 && (
              <p className="empty-state">No upcoming events yet.</p>
            )}
            <ul className="event-list">
              {upcomingEvents.map((event) => (
                <li className="event-item" key={event.id}>
                  <div className="event-date">
                    <strong>{event.date}</strong>
                    <span>{event.time}</span>
                  </div>
                  <div className="event-details">
                    <h3>{event.title}</h3>
                    <p>{event.location}</p>
                  </div>
                  <div className="event-actions">
                    <span className="event-source">{event.source}</span>
                    {currentUserId === event.userId && (
                      <>
                        <button
                          className="edit-event-button"
                          disabled={deletingEventId === event.id}
                          onClick={() => {
                            clearEventMessages();
                            setFormErrors({});
                            setEventForm(eventToForm(event));
                            setEventToEdit(event);
                            setIsAddModalOpen(false);
                          }}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          className="delete-event-button"
                          disabled={deletingEventId === event.id}
                          onClick={() => {
                            clearEventMessages();
                            setEventToDelete(event);
                          }}
                          type="button"
                        >
                          {deletingEventId === event.id ? "Deleting..." : "Delete"}
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </article>
        </section>
        {(isAddModalOpen || eventToEdit) && (
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
              <form className="event-form" onSubmit={handleSubmitEvent}>
                <label>
                  Event title
                  <input
                    autoFocus
                    onChange={handleEventField("title")}
                    type="text"
                    value={eventForm.title}
                  />
                  {formErrors.title && (
                    <span className="field-error">{formErrors.title}</span>
                  )}
                </label>
                <label>
                  Description
                  <textarea
                    onChange={handleEventField("description")}
                    rows={3}
                    value={eventForm.description}
                  />
                </label>
                <div className="event-form-row">
                  <label>
                    Date
                    <input
                      onChange={handleEventField("eventDate")}
                      type="date"
                      value={eventForm.eventDate}
                    />
                    {formErrors.eventDate && (
                      <span className="field-error">{formErrors.eventDate}</span>
                    )}
                  </label>
                  {!eventToEdit && (
                    <label>
                      Source type
                      <select
                        onChange={handleEventField("source")}
                        value={eventForm.source}
                      >
                        <option value="manual">manual</option>
                        <option value="community">community</option>
                        <option value="instagram">instagram</option>
                        <option value="discord">discord</option>
                      </select>
                    </label>
                  )}
                </div>
                <div className="event-form-row">
                  <label>
                    Start time
                    <input
                      onChange={handleEventField("startTime")}
                      type="time"
                      value={eventForm.startTime}
                    />
                    {formErrors.startTime && (
                      <span className="field-error">{formErrors.startTime}</span>
                    )}
                  </label>
                  <label>
                    End time
                    <input
                      onChange={handleEventField("endTime")}
                      type="time"
                      value={eventForm.endTime}
                    />
                    {formErrors.endTime && (
                      <span className="field-error">{formErrors.endTime}</span>
                    )}
                  </label>
                </div>
                <label>
                  Location
                  <input
                    onChange={handleEventField("location")}
                    type="text"
                    value={eventForm.location}
                  />
                </label>
                {createError && (
                  <p className="event-message event-message-error">{createError}</p>
                )}
                {updateError && (
                  <p className="event-message event-message-error">{updateError}</p>
                )}
                <div className="confirm-actions">
                  <button
                    className="btn-secondary"
                    disabled={savingEvent}
                    onClick={() => {
                      setIsAddModalOpen(false);
                      setEventToEdit(null);
                      setCreateError(null);
                      setUpdateError(null);
                      setFormErrors({});
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button className="btn-primary" disabled={savingEvent} type="submit">
                    {savingEvent
                      ? "Saving..."
                      : eventToEdit
                        ? "Save changes"
                        : "Save event"}
                  </button>
                </div>
              </form>
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
              <p>
                This will permanently remove the event from Supabase and your
                dashboard.
              </p>
              {deleteError && (
                <p className="event-message event-message-error">{deleteError}</p>
              )}
              <div className="confirm-actions">
                <button
                  className="btn-secondary"
                  disabled={deletingEventId === eventToDelete.id}
                  onClick={() => {
                    setEventToDelete(null);
                    setDeleteError(null);
                  }}
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
      </main>
    </div>
  );
}
export default Dashboard;
