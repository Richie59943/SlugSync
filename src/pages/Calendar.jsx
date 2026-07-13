import React, { useState, useEffect } from "react";
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

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

// "17:30" -> { hour: "5", minute: "30", ampm: "PM" }
function parse24(value) {
  if (!value) return { hour: "", minute: "", ampm: "" };
  const [h, m] = value.split(":");
  const hourNum = parseInt(h, 10);
  const ampm = hourNum >= 12 ? "PM" : "AM";
  let hour12 = hourNum % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour: String(hour12), minute: m, ampm };
}

// ("5", "30", "PM") -> "17:30"
function to24(hour, minute, ampm) {
  if (!hour || !minute || !ampm) return "";
  let h = parseInt(hour, 10);
  if (ampm === "AM" && h === 12) h = 0;
  if (ampm === "PM" && h !== 12) h += 12;
  return `${String(h).padStart(2, "0")}:${minute}`;
}

function TimePicker({ label, value, onChange, invalid }) {
  const [custom, setCustom] = useState(false);
  const [parts, setParts] = useState(() => parse24(value));

  // Re-sync when the parent value changes from outside (AI parse, event click, reset)
  useEffect(() => {
    setParts(parse24(value));
  }, [value]);

  function update(field, val) {
    const next = { ...parts, [field]: val };
    setParts(next);
    onChange(to24(next.hour, next.minute, next.ampm));
  }

  const selectStyle = {
    padding: "0.4rem",
    borderRadius: "0.4rem",
    border: `1px solid ${invalid ? "#993C1D" : "#D6D4CE"}`,
    background: invalid ? "#FDF3F0" : "white",
  };

  return (
    <div style={{ display: "grid", gap: "0.25rem", flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span>{label}</span>
        <button
          type="button"
          onClick={() => setCustom((c) => !c)}
          style={{
            border: "none",
            background: "transparent",
            color: "#6B6A66",
            fontSize: "0.75rem",
            textDecoration: "underline",
            cursor: "pointer",
            padding: 0,
          }}
        >
          {custom ? "use dropdowns" : "custom"}
        </button>
      </div>

      {custom ? (
        <input
          type="time"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...selectStyle, width: "100%" }}
        />
      ) : (
        <div style={{ display: "flex", gap: "0.3rem" }}>
          <select
            value={parts.hour}
            onChange={(e) => update("hour", e.target.value)}
            style={{ ...selectStyle, flex: 1 }}
          >
            <option value="">--</option>
            {HOURS.map((h) => (
              <option key={h} value={String(h)}>{h}</option>
            ))}
          </select>
          <select
            value={parts.minute}
            onChange={(e) => update("minute", e.target.value)}
            style={{ ...selectStyle, flex: 1 }}
          >
            <option value="">--</option>
            {MINUTES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select
            value={parts.ampm}
            onChange={(e) => update("ampm", e.target.value)}
            style={{ ...selectStyle, flex: 1 }}
          >
            <option value="">--</option>
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>
      )}
    </div>
  );
}

function Calendar() {
  const [events, setEvents] = useState(initialEvents);
  const [showAiBox, setShowAiBox] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [missing, setMissing] = useState([]);

  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const isEditing = form.id !== null;

  function handleField(field) {
    return (e) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
      setFormError("");
      setMissing((m) => m.filter((x) => x !== field));
    };
  }

  function setTimeField(field) {
    return (value) => {
      setForm((f) => ({ ...f, [field]: value }));
      setFormError("");
      if (value) setMissing((m) => m.filter((x) => x !== field));
    };
  }

  function openManualForm() {
    setForm(emptyForm);
    setFormError("");
    setMissing([]);
    setShowForm(true);
  }

  function closeForm() {
    setForm(emptyForm);
    setFormError("");
    setMissing([]);
    setShowForm(false);
  }

  function closeAiBox() {
    setShowAiBox(false);
    setAiText("");
    setAiError("");
  }

  async function handleAiParse() {
    if (!aiText.trim()) {
      setAiError("Describe your event first.");
      return;
    }

    setAiLoading(true);
    setAiError("");

    const today = toDateString(new Date());

    const prompt = `Today's date is ${today}.
Extract event details from this text and return ONLY a JSON object, no markdown, no code fences, no explanation.

Format:
{"title": string or null, "date": "YYYY-MM-DD" or null, "startTime": "HH:MM" or null, "endTime": "HH:MM" or null, "location": string or null}

Resolve relative dates (like "next Tuesday") against today's date. Use 24-hour time.
Use null for anything not mentioned — do not guess.
If the text contains no event at all, return {"error": "no event found"}.

Text: ${aiText}`;

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );

      if (!res.ok) {
        const errBody = await res.text();
        console.error("Gemini API error:", errBody);
        setAiError(`API error (${res.status}). Check the console.`);
        return;
      }

      const data = await res.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();

      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        console.error("Could not parse as JSON:", raw);
        setAiError("Couldn't understand the response. Try rephrasing.");
        return;
      }

      if (parsed.error) {
        setAiError("Couldn't find an event in that text. Try being more specific.");
        return;
      }

      const gaps = [];
      if (!parsed.title) gaps.push("title");
      if (!parsed.date) gaps.push("date");
      if (!parsed.startTime) gaps.push("startTime");

      setForm({
        id: null,
        title: parsed.title || "",
        date: parsed.date || "",
        startTime: parsed.startTime || "",
        endTime: parsed.endTime || "",
        location: parsed.location || "",
      });
      setMissing(gaps);
      setFormError(
        gaps.length
          ? "Some details are missing — the highlighted fields need your input."
          : ""
      );
      setShowForm(true);
      closeAiBox();
    } catch (err) {
      console.error(err);
      setAiError("Request failed. Check your connection and API key.");
    } finally {
      setAiLoading(false);
    }
  }

  function handleEventClick(clickInfo) {
    const ev = clickInfo.event;
    const start = ev.start;
    const end = ev.end;

    setForm({
      id: ev.id,
      title: ev.title,
      date: start ? toDateString(start) : "",
      startTime: ev.allDay || !start ? "" : toTimeString(start),
      endTime: ev.allDay || !end ? "" : toTimeString(end),
      location: ev.extendedProps.location || "",
    });
    setFormError("");
    setMissing([]);
    setShowAiBox(false);
    setShowForm(true);
  }

  function handleSave() {
    const gaps = [];
    if (!form.title.trim()) gaps.push("title");
    if (!form.date) gaps.push("date");

    if (gaps.length) {
      setMissing(gaps);
      setFormError("Please fill in the highlighted fields.");
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
      if (form.endTime) built.end = `${form.date}T${form.endTime}`;
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

  const inputStyle = (field) => ({
    padding: "0.45rem",
    borderRadius: "0.4rem",
    border: `1px solid ${missing.includes(field) ? "#993C1D" : "#D6D4CE"}`,
    background: missing.includes(field) ? "#FDF3F0" : "white",
  });

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
        {!showAiBox && (
          <button onClick={() => setShowAiBox(true)} style={primaryBtn}>
            + Add event
          </button>
        )}
      </section>

      {showAiBox && (
        <section className="panel" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
          <div style={{ display: "grid", gap: "0.5rem", maxWidth: "640px" }}>
            <label style={fieldLabel}>
              <span>Describe an event</span>
              <textarea
                autoFocus
                value={aiText}
                onChange={(e) => {
                  setAiText(e.target.value);
                  setAiError("");
                }}
                rows={2}
                placeholder="surf club meeting next Tuesday 5pm at Main Beach"
                style={{
                  resize: "vertical",
                  padding: "0.45rem",
                  borderRadius: "0.4rem",
                  border: "1px solid #D6D4CE",
                }}
              />
            </label>

            {aiError && <p style={{ color: "#993C1D", margin: 0 }}>{aiError}</p>}

            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <button
                onClick={handleAiParse}
                disabled={aiLoading}
                style={{ ...primaryBtn, opacity: aiLoading ? 0.6 : 1 }}
              >
                {aiLoading ? "Thinking..." : "Add with AI"}
              </button>
              <button
                onClick={() => {
                  closeAiBox();
                  openManualForm();
                }}
                style={smallGhostBtn}
              >
                enter manually
              </button>
              <button onClick={closeAiBox} style={smallGhostBtn}>
                cancel
              </button>
            </div>
          </div>
        </section>
      )}

      {showForm && (
        <section className="panel" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
          <div style={{ display: "grid", gap: "0.75rem", maxWidth: "480px" }}>
            <h2 style={{ margin: 0 }}>{isEditing ? "Edit event" : "Review event"}</h2>

            <label style={fieldLabel}>
              <span>Title</span>
              <input
                type="text"
                value={form.title}
                onChange={handleField("title")}
                placeholder="Club meeting"
                style={inputStyle("title")}
              />
            </label>

            <label style={fieldLabel}>
              <span>Date</span>
              <input
                type="date"
                value={form.date}
                onChange={handleField("date")}
                style={inputStyle("date")}
              />
            </label>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <TimePicker
                label="Start time"
                value={form.startTime}
                onChange={setTimeField("startTime")}
                invalid={missing.includes("startTime")}
              />
              <TimePicker
                label="End time"
                value={form.endTime}
                onChange={setTimeField("endTime")}
                invalid={missing.includes("endTime")}
              />
            </div>

            <label style={fieldLabel}>
              <span>Location</span>
              <input
                type="text"
                value={form.location}
                onChange={handleField("location")}
                placeholder="East Field"
                style={inputStyle("location")}
              />
            </label>

            {formError && <p style={{ color: "#993C1D", margin: 0 }}>{formError}</p>}

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button onClick={handleSave} style={primaryBtn}>
                {isEditing ? "Save changes" : "Finalize"}
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

const smallGhostBtn = {
  padding: "0.4rem 0.7rem",
  borderRadius: "0.5rem",
  border: "none",
  background: "transparent",
  color: "#6B6A66",
  fontSize: "0.85rem",
  textDecoration: "underline",
  cursor: "pointer",
};

export default Calendar;
