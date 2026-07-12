import React, { useEffect, useMemo, useState } from "react";

const EMPTY_DRAFT = { clubs: [], classes: [], categories: [] };

function uniqueSorted(values) {
  const seen = new Map();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) seen.set(key, trimmed);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

// Builds the checkbox option lists from whatever events are currently in
// memory (mock or real) plus the user's already-saved selections, so saved
// preferences stay visible/selectable even if no event currently matches them.
function buildOptions(events, preferences) {
  return {
    clubs: uniqueSorted([
      ...events.map((e) => e.club),
      ...(preferences.clubs || []),
    ]),
    classes: uniqueSorted([
      ...events.map((e) => e.class_code ?? e.class),
      ...(preferences.classes || []),
    ]),
    categories: uniqueSorted([
      ...events.map((e) => e.category),
      ...(preferences.categories || []),
    ]),
  };
}

function toggleValue(list, value) {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

function PreferenceGroup({ title, field, options, draft, onToggle }) {
  if (options.length === 0) return null;

  return (
    <fieldset className="preferences-group">
      <legend>{title}</legend>
      <div className="preferences-options">
        {options.map((option) => (
          <label key={option} className="preferences-option">
            <input
              type="checkbox"
              checked={draft[field].includes(option)}
              onChange={() => onToggle(field, option)}
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function PreferencesFilter({ events, userId, preferences, status, error, onSave, onClear }) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const options = useMemo(() => buildOptions(events, preferences), [events, preferences]);

  // Reset the draft to the saved preferences whenever they load or the
  // panel is (re)opened, so edits don't persist across a cancelled open.
  useEffect(() => {
    if (isOpen) setDraft(preferences);
  }, [isOpen, preferences]);

  const activeCount =
    preferences.clubs.length + preferences.classes.length + preferences.categories.length;

  function handleToggle(field, value) {
    setDraft((prev) => ({ ...prev, [field]: toggleValue(prev[field], value) }));
  }

  async function handleSave() {
    try {
      await onSave(draft);
      setIsOpen(false);
    } catch {
      // status/error surfaced via props; keep the panel open so the user can retry
    }
  }

  async function handleClearAll() {
    setDraft(EMPTY_DRAFT);
    try {
      await onClear();
      setIsOpen(false);
    } catch {
      // status/error surfaced via props
    }
  }

  if (!userId) {
    return (
      <div className="preferences-filter">
        <button className="pill" disabled type="button" title="Sign in to set preferences">
          Preferences
        </button>
      </div>
    );
  }

  return (
    <div className="preferences-filter">
      <button
        aria-expanded={isOpen}
        className={`pill${activeCount > 0 ? " is-active" : ""}`}
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        Preferences{activeCount > 0 ? ` (${activeCount})` : ""}
      </button>

      {isOpen && (
        <section aria-label="Preferences" className="preferences-panel">
          {status === "loading" && <p className="preferences-status">Loading preferences…</p>}
          {status === "error" && error && (
            <p className="event-message event-message-error">{error}</p>
          )}
          {status === "success" && (
            <p className="event-message event-message-success">Preferences saved.</p>
          )}

          <PreferenceGroup
            title="Categories"
            field="categories"
            options={options.categories}
            draft={draft}
            onToggle={handleToggle}
          />
          <PreferenceGroup
            title="Clubs"
            field="clubs"
            options={options.clubs}
            draft={draft}
            onToggle={handleToggle}
          />
          <PreferenceGroup
            title="Classes"
            field="classes"
            options={options.classes}
            draft={draft}
            onToggle={handleToggle}
          />

          {options.categories.length === 0 &&
            options.clubs.length === 0 &&
            options.classes.length === 0 && (
              <p className="preferences-status">No clubs, classes, or categories found yet.</p>
            )}

          <div className="confirm-actions">
            <button
              className="btn-secondary"
              disabled={status === "saving"}
              onClick={handleClearAll}
              type="button"
            >
              Clear all
            </button>
            <button
              className="btn-primary"
              disabled={status === "saving"}
              onClick={handleSave}
              type="button"
            >
              {status === "saving" ? "Saving…" : "Save preferences"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export default PreferencesFilter;
