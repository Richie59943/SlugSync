import React, { useRef, useState } from "react";
import FilterNav from "../components/FilterNav";
import { initialEvents } from "../data/mockEvents";

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
    () => new URLSearchParams(window.location.search).get(key) || "all"
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
      window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash
    );
  }

  return [value, update];
}

function matchesWho(event, who) {
  if (who === "community") return event.visibility === "public";
  if (who === "personal") return event.visibility === "personal";
  return true;
}

function matchesWhen(event, when) {
  if (when === "all") return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${event.date}T00:00`);
  if (when === "today") return date.getTime() === today.getTime();
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return date >= today && date < weekEnd;
}

function formatDate(iso) {
  return new Date(`${iso}T00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatTime(hhmm) {
  return new Date(`2000-01-01T${hhmm}`).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function Dashboard() {
  const [events, setEvents] = useState(initialEvents);
  const [who, setWho] = useUrlFilter("who");
  const [when, setWhen] = useUrlFilter("when");
  const dialogRef = useRef(null);

  const visible = events.filter(
    (e) => matchesWho(e, who) && matchesWhen(e, when)
  );

  function handleCreate(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    setEvents([{ ...data, id: Date.now(), source: "Posted" }, ...events]);
    e.target.reset();
    dialogRef.current.close();
  }

  return (
    <main className="dashboard">
      <section className="welcome-section" aria-labelledby="welcome-title">
        <div>
          <p className="eyebrow">Santa Cruz, CA</p>
          <h1 id="welcome-title">Your event dashboard.</h1>
          <p>
            Browse events happening around Santa Cruz alongside your personal
            schedule, or post one of your own.
          </p>
        </div>
        <button
          className="create-button"
          onClick={() => dialogRef.current.showModal()}
        >
          + Create Event
        </button>
      </section>

      <div className="filter-bar">
        <FilterNav
          label="Filter by feed"
          options={WHO_OPTIONS}
          value={who}
          onChange={setWho}
        />
        <FilterNav
          label="Filter by date"
          options={WHEN_OPTIONS}
          value={when}
          onChange={setWhen}
        />
      </div>

      <section className="event-grid" aria-label="Events">
        {visible.map((event) => (
          <article className="event-card" key={event.id}>
            <div className="event-card-header">
              <span
                className={`badge badge-${
                  event.visibility === "public" ? "public" : "personal"
                }`}
              >
                {event.visibility === "public" ? "Public" : "Personal"}
              </span>
              <span className="event-source">{event.source}</span>
            </div>
            <h3>{event.title}</h3>
            <p className="event-when">
              {formatDate(event.date)} · {formatTime(event.time)}
            </p>
            <p className="event-where">{event.location}</p>
            {event.description && <p>{event.description}</p>}
          </article>
        ))}
        {visible.length === 0 && (
          <p className="empty-state">No events match these filters.</p>
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

      <dialog ref={dialogRef} className="event-dialog">
        <form onSubmit={handleCreate}>
          <h2>Create event</h2>
          <label>
            Title
            <input name="title" required />
          </label>
          <label>
            Date
            <input name="date" type="date" required />
          </label>
          <label>
            Time
            <input name="time" type="time" required />
          </label>
          <label>
            Location
            <input name="location" required />
          </label>
          <label>
            Description
            <textarea name="description" rows="3" />
          </label>
          <label>
            Visibility
            <select name="visibility">
              <option value="personal">Personal — only you</option>
              <option value="public">Public — posted to community</option>
            </select>
          </label>
          <div className="dialog-actions">
            <button type="button" onClick={() => dialogRef.current.close()}>
              Cancel
            </button>
            <button type="submit" className="create-button">
              Post event
            </button>
          </div>
        </form>
      </dialog>
    </main>
  );
}

export default Dashboard;
