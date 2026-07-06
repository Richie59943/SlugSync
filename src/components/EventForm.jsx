import React, { useEffect, useState } from "react";

const emptyForm = {
  title: "",
  description: "",
  eventDate: "",
  startTime: "",
  endTime: "",
  location: "",
};

function normalizeFormData(data) {
  return {
    title: data?.title ?? "",
    description: data?.description ?? "",
    eventDate: data?.eventDate ?? "",
    startTime: data?.startTime ?? "",
    endTime: data?.endTime ?? "",
    location: data?.location ?? "",
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
}) {
  const [form, setForm] = useState(() => normalizeFormData(initialData));
  const [errors, setErrors] = useState({});
  const isEditMode = mode === "edit";

  useEffect(() => {
    setForm(isEditMode ? normalizeFormData(initialData) : emptyForm);
    setErrors({});
  }, [initialData, isEditMode]);

  function handleField(field) {
    return (event) => {
      setForm((currentForm) => ({ ...currentForm, [field]: event.target.value }));
      setErrors((currentErrors) => ({ ...currentErrors, [field]: null }));
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
            onChange={handleField("eventDate")}
            type="date"
            value={form.eventDate}
          />
          {errors.eventDate && (
            <span className="field-error">{errors.eventDate}</span>
          )}
        </label>
        <label>
          Start time
          <input
            onChange={handleField("startTime")}
            type="time"
            value={form.startTime}
          />
          {errors.startTime && (
            <span className="field-error">{errors.startTime}</span>
          )}
        </label>
      </div>
      <div className="event-form-row">
        <label>
          End time
          <input
            onChange={handleField("endTime")}
            type="time"
            value={form.endTime}
          />
          {errors.endTime && <span className="field-error">{errors.endTime}</span>}
        </label>
        <label>
          Location
          <input
            onChange={handleField("location")}
            type="text"
            value={form.location}
          />
        </label>
      </div>
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
