import React, { useEffect, useState } from "react";
import {
  EVENT_VISIBILITY,
  EVENT_VISIBILITY_OPTIONS,
  normalizeEventVisibility,
} from "../data/eventVisibility";

const emptyForm = {
  title: "",
  description: "",
  eventDate: "",
  startTime: "",
  endTime: "",
  location: "",
  visibility: EVENT_VISIBILITY.PRIVATE,
};

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = ["00", "15", "30", "45"];

// Existing events may have been saved with a minute outside the 15-minute
// set (e.g. from before this change, or an external import). Keep that exact
// value selectable/visible instead of silently rounding it away — it only
// gets replaced if the user actively picks a different minute and saves.
function minuteOptionsFor(currentMinute) {
  if (!currentMinute || MINUTES.includes(currentMinute)) return MINUTES;
  return [...MINUTES, currentMinute].sort();
}

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

function TimePicker({ label, value, onChange, error }) {
  const [custom, setCustom] = useState(false);
  const [parts, setParts] = useState(() => parse24(value));

  useEffect(() => {
    setParts(parse24(value));
  }, [value]);

  function update(field, val) {
    const next = { ...parts, [field]: val };
    setParts(next);
    onChange(to24(next.hour, next.minute, next.ampm));
  }

  return (
    <label>
      <span className="time-picker-label">
        {label}
        <button
          className="time-picker-toggle"
          onClick={() => setCustom((c) => !c)}
          type="button"
        >
          {custom ? "use dropdowns" : "custom"}
        </button>
      </span>

      {custom ? (
        <input
          onChange={(e) => onChange(e.target.value)}
          type="time"
          value={value}
        />
      ) : (
        <div className="time-picker-selects">
          <select onChange={(e) => update("hour", e.target.value)} value={parts.hour}>
            <option value="">--</option>
            {HOURS.map((h) => (
              <option key={h} value={String(h)}>{h}</option>
            ))}
          </select>
          <select
            className="time-picker-minute"
            onChange={(e) => update("minute", e.target.value)}
            value={parts.minute}
          >
            <option value="">--</option>
            {minuteOptionsFor(parts.minute).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select onChange={(e) => update("ampm", e.target.value)} value={parts.ampm}>
            <option value="">--</option>
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>
      )}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

function normalizeFormData(data) {
  return {
    title: data?.title ?? "",
    description: data?.description ?? "",
    eventDate: data?.eventDate ?? "",
    startTime: data?.startTime ?? "",
    endTime: data?.endTime ?? "",
    location: data?.location ?? "",
    visibility: normalizeEventVisibility(data?.visibility),
  };
}

function validateForm(form) {
  const errors = {};

  if (!form.title.trim()) {
    errors.title = "Event title is required.";
  }

  if (!form.eventDate) {
    errors.eventDate = "Date is required.";
  }

  if (!form.startTime) {
    errors.startTime = "Start time is required.";
  }

  if (form.startTime && form.endTime && form.endTime <= form.startTime) {
    errors.endTime = "End time must be after the start time.";
  }

  return errors;
}

function EventForm({
  mode = "add",
  initialData = emptyForm,
  onSubmit,
  onCancel,
  isLoading = false,
  error = null,
  missingFields = [],
}) {
  const [form, setForm] = useState(() => normalizeFormData(initialData));
  const [errors, setErrors] = useState({});
  const isEditMode = mode === "edit";

  // Always seed from initialData — this is what lets AI-parsed details prefill a new event
  useEffect(() => {
    setForm(normalizeFormData(initialData));
    const seeded = {};
    missingFields.forEach((field) => {
      seeded[field] = "The AI couldn't find this — please fill it in.";
    });
    setErrors(seeded);
  }, [initialData]);

  function handleField(field) {
    return (event) => {
      setForm((currentForm) => ({ ...currentForm, [field]: event.target.value }));
      setErrors((currentErrors) => ({ ...currentErrors, [field]: null }));
    };
  }

  function setTimeField(field) {
    return (value) => {
      setForm((currentForm) => ({ ...currentForm, [field]: value }));
      if (value) {
        setErrors((currentErrors) => ({ ...currentErrors, [field]: null }));
      }
    };
  }

  function handleSubmit(event) {
    event.preventDefault();

    const validationErrors = validateForm(form);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    onSubmit({
      ...form,
      title: form.title.trim(),
      description: form.description.trim(),
      location: form.location.trim(),
    });
  }

  return (
    <form className="event-form" onSubmit={handleSubmit}>
      <label>
        Event title
        <input
          autoFocus
          className={errors.title ? "field-invalid" : ""}
          onChange={handleField("title")}
          type="text"
          value={form.title}
        />
        {errors.title && <span className="field-error">{errors.title}</span>}
      </label>
      <label>
        Description
        <textarea
          onChange={handleField("description")}
          rows={3}
          value={form.description}
        />
      </label>
      <div className="event-form-row">
        <label>
          Date
          <input
            className={errors.eventDate ? "field-invalid" : ""}
            onChange={handleField("eventDate")}
            type="date"
            value={form.eventDate}
          />
          {errors.eventDate && (
            <span className="field-error">{errors.eventDate}</span>
          )}
        </label>
        <TimePicker
          error={errors.startTime}
          label="Start time"
          onChange={setTimeField("startTime")}
          value={form.startTime}
        />
      </div>
      <div className="event-form-row">
        <TimePicker
          error={errors.endTime}
          label="End time"
          onChange={setTimeField("endTime")}
          value={form.endTime}
        />
        <label>
          Location
          <input
            onChange={handleField("location")}
            type="text"
            value={form.location}
          />
        </label>
      </div>
      <fieldset className="visibility-fieldset">
        <legend>Event visibility</legend>
        <div className="visibility-options">
          {EVENT_VISIBILITY_OPTIONS.map((option) => (
            <label className="visibility-option" key={option.value}>
              <input
                checked={form.visibility === option.value}
                name="event-visibility"
                onChange={handleField("visibility")}
                type="radio"
                value={option.value}
              />
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {error && <p className="event-message event-message-error">{error}</p>}
      <div className="confirm-actions">
        <button
          className="btn-secondary"
          disabled={isLoading}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button className="btn-primary" disabled={isLoading} type="submit">
          {isLoading ? "Saving..." : isEditMode ? "Save changes" : "Save event"}
        </button>
      </div>
    </form>
  );
}

export default EventForm;
