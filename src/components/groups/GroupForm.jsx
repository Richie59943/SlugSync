import React, { useEffect, useState } from "react";
import MemberSelector from "./MemberSelector";

const emptyForm = {
  name: "",
  description: "",
  memberIds: [],
};

function validateForm(form) {
  const errors = {};

  if (!form.name.trim()) {
    errors.name = "Group name is required.";
  }

  return errors;
}

function GroupForm({
  friends = [],
  onCancel,
  onSubmit,
  isLoading = false,
  error = null,
}) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setForm(emptyForm);
    setErrors({});
  }, []);

  function handleField(field) {
    return (event) => {
      setForm((currentForm) => ({
        ...currentForm,
        [field]: event.target.value,
      }));
      setErrors((currentErrors) => ({ ...currentErrors, [field]: null }));
    };
  }

  function handleMembersChange(memberIds) {
    setForm((currentForm) => ({ ...currentForm, memberIds }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    const validationErrors = validateForm(form);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    onSubmit({
      name: form.name.trim(),
      description: form.description.trim(),
      memberIds: form.memberIds,
    });
  }

  return (
    <form className="group-form" onSubmit={handleSubmit}>
      <label className="group-form-label">
        Group name
        <input
          autoFocus
          className="group-form-input"
          onChange={handleField("name")}
          placeholder="Study crew"
          type="text"
          value={form.name}
        />
        {errors.name && <span className="field-error">{errors.name}</span>}
      </label>

      <label className="group-form-label">
        Description
        <textarea
          className="group-form-input"
          onChange={handleField("description")}
          placeholder="Optional notes about this group"
          rows={3}
          value={form.description}
        />
      </label>

      <MemberSelector
        friends={friends}
        onChange={handleMembersChange}
        selectedIds={form.memberIds}
      />

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
          {isLoading ? "Creating..." : "Create group"}
        </button>
      </div>
    </form>
  );
}

export default GroupForm;
