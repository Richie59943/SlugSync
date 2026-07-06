import React, { useEffect, useState } from "react";
import { calendarDays, calendarPreview } from "../data/mockEvents";
import { formatEventRow } from "../data/formatEventRow";
import { supabase } from "../lib/supabaseClient";

function Dashboard() {
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
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

  return (
    <div className="app-shell">
      <nav className="navbar" aria-label="Main navigation">
        <a className="brand" href="/">
          SlugSync
        </a>
        <div className="nav-links">
          <a href="/">Dashboard</a>
          <a href="/">Calendar</a>
          <a href="/">Sources</a>
        </div>
      </nav>
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
                  <span className="event-source">{event.source}</span>
                </li>
              ))}
            </ul>
          </article>
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
      </main>
    </div>
  );
}
export default Dashboard;
