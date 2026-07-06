import React, { useEffect, useState } from "react";
import { calendarDays, calendarPreview } from "../data/mockEvents";
import { deleteEvent } from "../data/eventService";
import { formatEventRow } from "../data/formatEventRow";
import { supabase } from "../lib/supabaseClient";

function Dashboard() {
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [deleteSuccess, setDeleteSuccess] = useState(null);
  const [deletingEventId, setDeletingEventId] = useState(null);
  const [eventToDelete, setEventToDelete] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!cancelled) {
        setCurrentUserId(user?.id ?? null);
      }

      const { data, error: fetchError } = await supabase
        .from("events")
        .select("*")
        .order("event_date", { ascending: true })
        .order("event_time", { ascending: true });

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setUpcomingEvents(data.map(formatEventRow));
      }
      setLoading(false);
    }

    loadEvents();
    return () => {
      cancelled = true;
    };
  }, []);

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
            {deleteError && (
              <p className="event-message event-message-error">{deleteError}</p>
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
                      <button
                        className="delete-event-button"
                        disabled={deletingEventId === event.id}
                        onClick={() => {
                          setDeleteError(null);
                          setDeleteSuccess(null);
                          setEventToDelete(event);
                        }}
                        type="button"
                      >
                        {deletingEventId === event.id ? "Deleting..." : "Delete"}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </article>
        </section>
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
