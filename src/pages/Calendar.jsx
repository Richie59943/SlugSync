import React, { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

const initialEvents = [
  { id: "1", title: "Surf club", date: "2026-07-03", color: "#5DCAA5" },
  { id: "2", title: "Study group", date: "2026-07-07", color: "#F0997B" },
  { id: "3", title: "AI pick: farmers market", date: "2026-07-08", color: "#EF9F27" },
  { id: "4", title: "Beach cleanup", date: "2026-07-15", color: "#5DCAA5" },
];

const emptyForm = {
  id: null,
  title: "",
  date: "",
  startTime: "",
  endTime: "",
  location: "",
};

function Calendar() {
  const [events, setEvents] = useState(initialEvents);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");

  const isEditing = form.id !== null;

  function handleField(field) {
    return (e) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
      setFormError("");
    };
  }

  function openAddForm() {
    setForm(emptyForm);
    setFormError("");
    setShowForm(true);
  }

  function closeForm() {
    setForm(emptyForm);
    setFormError("");
    setShowForm(false);
  }

  function handleEventClick(clickInfo) {
    const ev = clickInfo.event;

    // Pull date + times back out of the clicked event
    const start = ev.start;
    const end = ev.end;
    const dateStr = start ? toDateString(start) : "";
    const startTimeStr = ev.allDay || !start ? "" : toTimeString(start);
    const endTimeStr = ev.allDay || !end ? "" : toTimeString(end);

    setForm({
      id: ev.id,
      title: ev.title,
      date: dateStr,
      startTime: startTimeStr,
      endTime: endTimeStr,
      location: ev.extendedProps.location || "",
    });
    setFormError("");
    setShowForm(true);
  }

  function handleSave() {
    if (!form.title.trim()) {
      setFormError("Please enter a title.");
      return;
    }
    if (!form.date) {
      setFormError("Please pick a date.");
      return;
    }

    const built = {
      id: isEditing ? form.id : String(Date.now()),
      title: form.title,
      color: "#F0997B",
      extendedProps: { location: form.location },
    };

    if (form.startTime) {
      built.start = `${form.date}T${form.startTime}`;
      if (form.endTime) {
        built.end = `${form.date}T${form.endTime}`;
      }
    } else {
      built.date = form.date;
    }

    if (isEditing) {
      setEvents((prev) => prev.map((e) => (e.id === form.id ? built : e)));
    } else {
      setEvents((prev) => [...prev, built]);
    }

    closeForm();
  }

  function handleDelete() {
    setEvents((prev) => prev.filter((e) => e.id !== form.id));
    closeForm();
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
          <p>Click any event to edit it, or add a new one.</p>
        </div>
        <button onClick={openAddForm} style={primaryBtn}>
          + Add event
        </button>
      </section>

      {showForm && (
        <section className="panel" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
          <div style={{ display: "grid", gap: "0.75rem", maxWidth: "480px" }}>
            <h2 style={{ margin: 0 }}>{isEditing ? "Edit event" : "Add event"}</h2>

            <label style={fieldLabel}>
              <span>Title</span>
              <input type="text" value={form.title} onChange={handleField("title")} placeholder="Club meeting" />
            </label>

            <label style={fieldLabel}>
              <span>Date</span>
              <input type="date" value={form.date} onChange={handleField("date")} />
            </label>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <label style={{ ...fieldLabel, flex: 1 }}>
                <span>Start time</span>
                <input type="time" value={form.startTime} onChange={handleField("startTime")} />
              </label>
              <label style={{ ...fieldLabel, flex: 1 }}>
                <span>End time</span>
                <input type="time" value={form.endTime} onChange={handleField("endTime")} />
              </label>
            </div>

            <label style={fieldLabel}>
              <span>Location</span>
              <input type="text" value={form.location} onChange={handleField("location")} placeholder="East Field" />
            </label>

            {formError && <p style={{ color: "#993C1D", margin: 0 }}>{formError}</p>}

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button onClick={handleSave} style={primaryBtn}>
                {isEditing ? "Save changes" : "Save event"}
              </button>
              {isEditing && (
                <button onClick={handleDelete} style={dangerBtn}>
                  Delete
                </button>
              )}
              <button onClick={closeForm} style={ghostBtn}>
                Cancel
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="panel" style={{ padding: "1.5rem" }}>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          events={events}
          eventClick={handleEventClick}
          height="auto"
        />
      </section>
    </main>
  );
}

// Helpers: turn a Date object into the strings the inputs need
function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toTimeString(date) {
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${min}`;
}

const fieldLabel = { display: "grid", gap: "0.25rem" };

const primaryBtn = {
  padding: "0.6rem 1.1rem",
  borderRadius: "0.6rem",
  border: "none",
  background: "#0F6E56",
  color: "white",
  fontWeight: 500,
  cursor: "pointer",
};

const dangerBtn = {
  padding: "0.6rem 1.1rem",
  borderRadius: "0.6rem",
  border: "none",
  background: "#993C1D",
  color: "white",
  fontWeight: 500,
  cursor: "pointer",
};

const ghostBtn = {
  padding: "0.6rem 1.1rem",
  borderRadius: "0.6rem",
  border: "1px solid #B4B2A9",
  background: "transparent",
  color: "#444441",
  fontWeight: 500,
  cursor: "pointer",
};

export default Calendar;
