import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import EventForm from "../components/EventForm";
import {
  createEvent,
  deleteEvent,
  fetchCalendarEvents,
  syncEventGroups,
  updateEvent,
} from "../data/eventService";
import { fetchGroups } from "../data/groupService";
import { formatEventRow } from "../data/formatEventRow";
import { useQuickAdd } from "../context/QuickAddContext";
import { CATEGORY_PALETTE, getCategoryStyle } from "../data/categoryStyles";

const CATEGORY_ORDER = ["campus", "community", "clubs", "classes", "music", "outdoors"];

const CALENDAR_VIEWS = [
  { key: "dayGridMonth", label: "Month" },
  { key: "timeGridWeek", label: "Week" },
  { key: "timeGridDay", label: "Day" },
];

function toCalendarEvent(event) {
  const hasTime = Boolean(event.startTime);
  const cat = getCategoryStyle(event);
  const isGroupEvent = event.calendarScope === "group";
  const calendarEvent = {
    id: isGroupEvent
      ? `group:${event.groupId}:${event.id}`
      : `personal:${event.id}`,
    title: event.title,
    color: cat.dot,
    textColor: "#ffffff",
    classNames: isGroupEvent ? ["calendar-event-group"] : ["calendar-event-personal"],
    extendedProps: {
      eventData: event,
      location: event.location,
      visibility: event.visibility,
      calendarScope: event.calendarScope,
      groupName: event.groupName,
      groupShares: event.groupShares,
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

function Calendar({ groupId = null }) {
  const [events, setEvents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [message, setMessage] = useState(null);
  const [formError, setFormError] = useState(null);
  const [savingEvent, setSavingEvent] = useState(false);
  const [eventToEdit, setEventToEdit] = useState(null);
  const [eventToView, setEventToView] = useState(null);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [deletingEventId, setDeletingEventId] = useState(null);
  const [missingFields, setMissingFields] = useState([]);

  // AI describe box
  const [showAiBox, setShowAiBox] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  // Custom toolbar + sidebar state — drives FullCalendar via its ref API
  // instead of FullCalendar's own built-in toolbar.
  const calendarRef = useRef(null);
  const [calView, setCalView] = useState("dayGridMonth");
  const [calTitle, setCalTitle] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayString());

  const calendarEvents = useMemo(() => events.map(toCalendarEvent), [events]);
  const { registerOpenAdd } = useQuickAdd();

  const loadCalendarData = useCallback(async () => {
    const [{ events: rows, user }, { groups: nextGroups }] = await Promise.all([
      fetchCalendarEvents({ groupId }),
      fetchGroups(),
    ]);
    const routeGroup = groupId
      ? nextGroups.find((group) => group.id === groupId)
      : null;

    if (groupId && !routeGroup) {
      throw new Error("You do not have access to this group calendar.");
    }

    return { rows, user, nextGroups, routeGroup };
  }, [groupId]);

  function applyCalendarData({ rows, user, nextGroups, routeGroup }) {
    setCurrentUserId(user?.id ?? null);
    setEvents(rows.map(formatEventRow));
    setGroups(nextGroups);
    setSelectedGroup(routeGroup);
  }

  // Lets the shared nav's "+ Add event" button reuse this page's own flow.
  useEffect(() => registerOpenAdd(() => openAddForm()), [registerOpenAdd]);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      setLoading(true);
      setLoadError(null);

      try {
        const nextCalendarData = await loadCalendarData();
        if (cancelled) return;
        applyCalendarData(nextCalendarData);
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
  }, [loadCalendarData]);

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
    setEventToView(null);
    setFormError(null);
    setMessage(null);
  }

  function closeForm() {
    setEventToEdit(null);
    setEventToView(null);
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
    const clickedEvent = clickInfo.event.extendedProps.eventData;
    if (clickedEvent.userId === currentUserId) {
      setEventToEdit(clickedEvent);
      setEventToView(null);
    } else {
      setEventToView(clickedEvent);
      setEventToEdit(null);
    }
    setFormError(null);
    setMessage(null);
  }

  function handleDateClick(clickInfo) {
    setSelectedDate(clickInfo.dateStr.slice(0, 10));
  }

  function goPrev() {
    calendarRef.current?.getApi().prev();
  }

  function goNext() {
    calendarRef.current?.getApi().next();
  }

  function goToday() {
    calendarRef.current?.getApi().today();
  }

  function changeView(viewKey) {
    calendarRef.current?.getApi().changeView(viewKey);
    setCalView(viewKey);
  }

  async function handleSubmitEvent(eventInput) {
    setSavingEvent(true);
    setFormError(null);

    try {
      if (eventToEdit?.id) {
        const updated = formatEventRow(
          await updateEvent(eventToEdit.id, eventInput),
        );
        await syncEventGroups(eventToEdit.id, eventInput.groupIds);
        applyCalendarData(await loadCalendarData());
        setMessage(`Updated "${updated.title}".`);
      } else {
        const created = formatEventRow(await createEvent(eventInput));
        if (eventInput.groupIds?.length > 0) {
          await syncEventGroups(created.id, eventInput.groupIds);
          applyCalendarData(await loadCalendarData());
          setMessage(`Created "${created.title}" and updated group sharing.`);
        } else if (groupId) {
          applyCalendarData(await loadCalendarData());
          setMessage(`Created "${created.title}".`);
        } else {
          setEvents((currentEvents) => [...currentEvents, created]);
          setCurrentUserId(created.userId);
          setMessage(`Created "${created.title}".`);
        }
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

  const selectedDayEvents = events
    .filter((event) => event.eventDate === selectedDate)
    .sort((a, b) => (a.sortTime ?? "").localeCompare(b.sortTime ?? ""));
  const selectedDayLabel = new Date(`${selectedDate}T00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const categoryCounts = new Map();
  events.forEach((event) => {
    const key = getCategoryStyle(event).key;
    if (!key) return;
    categoryCounts.set(key, (categoryCounts.get(key) || 0) + 1);
  });
  const legend = CATEGORY_ORDER.filter((key) => categoryCounts.has(key)).map((key) => ({
    key,
    label: CATEGORY_PALETTE[key].label,
    dot: CATEGORY_PALETTE[key].dot,
    count: categoryCounts.get(key),
  }));

  return (
    <main className="dashboard">
      <style>{`
        .fc-event { cursor: pointer; transition: opacity 0.15s; }
        .fc-event:hover { opacity: 0.75; }
      `}</style>

      <section className="welcome-section">
        <div>
          <p className="eyebrow">Event calendar</p>
          <h1>{selectedGroup?.name ? selectedGroup.name : "Your calendar"}</h1>
          <p>
            {selectedGroup?.name
              ? "Group-shared events appear alongside your personal schedule."
              : "Describe an event in plain text, or click an event to edit it."}
          </p>
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

      <div className="calendar-layout">
        <section className="calendar-panel">
          {loading ? (
            <p className="empty-state">Loading calendar...</p>
          ) : (
            <>
              <div className="calendar-toolbar">
                <div className="calendar-toolbar-left">
                  <button
                    className="calendar-nav-button"
                    onClick={goPrev}
                    type="button"
                    aria-label="Previous"
                  >
                    ‹
                  </button>
                  <button
                    className="calendar-nav-button"
                    onClick={goNext}
                    type="button"
                    aria-label="Next"
                  >
                    ›
                  </button>
                  <button className="calendar-today-button" onClick={goToday} type="button">
                    Today
                  </button>
                  <span className="calendar-title">{calTitle}</span>
                </div>
                <div className="calendar-view-switch" role="tablist" aria-label="Calendar view">
                  {CALENDAR_VIEWS.map((view) => (
                    <button
                      key={view.key}
                      className={`calendar-view-button${calView === view.key ? " is-active" : ""}`}
                      onClick={() => changeView(view.key)}
                      type="button"
                      role="tab"
                      aria-selected={calView === view.key}
                    >
                      {view.label}
                    </button>
                  ))}
                </div>
              </div>

              <FullCalendar
                ref={calendarRef}
                dateClick={handleDateClick}
                datesSet={(arg) => setCalTitle(arg.view.title)}
                eventClick={handleEventClick}
                events={calendarEvents}
                headerToolbar={false}
                height="auto"
                initialView="dayGridMonth"
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              />
            </>
          )}
        </section>

        <aside className="dashboard-sidebar">
          <div className="panel">
            <div className="sidebar-card-title">{selectedDayLabel}</div>
            {selectedDayEvents.length === 0 && (
              <p className="empty-state" style={{ textAlign: "left", margin: 0 }}>
                No events this day.
              </p>
            )}
            {selectedDayEvents.map((event) => {
              const cat = getCategoryStyle(event);
              return (
                <div
                  key={event.id}
                  style={{ borderLeft: `3px solid ${cat.dot}`, padding: "2px 0 2px 12px", marginBottom: 10 }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14, fontFamily: "var(--font-display)" }}>
                    {event.title}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--color-text-muted)", marginTop: 2 }}>
                    {event.time}
                    {event.location ? ` · ${event.location}` : ""}
                  </div>
                  {event.calendarScope === "group" && (
                    <div className="calendar-group-label">
                      Group · {event.groupName || "Group"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {legend.length > 0 && (
            <div className="panel">
              <div className="sidebar-card-title">Categories</div>
              {legend.map((l) => (
                <div className="legend-row" key={l.key}>
                  <span className="legend-dot" style={{ background: l.dot }} />
                  <span className="legend-label">{l.label}</span>
                  <span className="legend-count">{l.count}</span>
                </div>
              ))}
            </div>
          )}

          {groups.length > 0 && (
            <div className="panel">
              <div className="sidebar-card-title">Group calendars</div>
              <div className="calendar-group-list">
                <a
                  className={!groupId ? "is-active" : ""}
                  href="#/calendar"
                >
                  All calendars
                </a>
                {groups.map((group) => (
                  <a
                    className={group.id === groupId ? "is-active" : ""}
                    href={`#/calendar/groups/${group.id}`}
                    key={group.id}
                  >
                    {group.name}
                  </a>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

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
            {eventToEdit.calendarScope === "group" && (
              <p className="calendar-detail-meta">
                Shared with {eventToEdit.groupName || "a group"}.
              </p>
            )}
            <EventForm
              error={formError}
              groups={groups}
              initialData={{
                ...eventToEdit,
                groupIds: eventToEdit.groupShares?.map((share) => share.groupId) ?? [],
              }}
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

      {eventToView && (
        <div
          aria-labelledby="calendar-event-detail-title"
          aria-modal="true"
          className="modal-backdrop"
          role="dialog"
        >
          <div className="confirm-dialog">
            <p className="eyebrow">
              {eventToView.calendarScope === "group" ? "Group event" : "Event"}
            </p>
            <h2 id="calendar-event-detail-title">{eventToView.title}</h2>
            <p className="event-when">
              {eventToView.date} · {eventToView.time}
            </p>
            {eventToView.location && <p>{eventToView.location}</p>}
            {eventToView.description && <p>{eventToView.description}</p>}
            {eventToView.calendarScope === "group" && (
              <p className="calendar-detail-meta">
                Shared with {eventToView.groupName || "a group"}.
              </p>
            )}
            <div className="confirm-actions">
              <button className="btn-primary" onClick={closeForm} type="button">
                Close
              </button>
            </div>
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
