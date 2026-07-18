import React, { useEffect, useMemo, useState } from "react";
import { CATEGORY_PALETTE } from "../data/categoryStyles";

const EMPTY_DRAFT = { clubs: [], classes: [], categories: [] };

// Categories are a real, fixed taxonomy already used across the app (event
// badges, Dashboard/Calendar filter chips) — always offering them here isn't
// inventing data, it just exposes the same taxonomy as selectable filters.
const CATEGORY_OPTIONS = Object.values(CATEGORY_PALETTE).map((entry) => entry.label);

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

// Builds the option lists from whatever events are currently in memory (mock
// or real) plus the user's already-saved selections, so saved preferences
// stay visible/selectable even if no event currently matches them. Clubs and
// classes are strictly derived from real event data — never fabricated —
// while categories always include the app's fixed category taxonomy on top
// of any literal category text found on events.
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
      ...CATEGORY_OPTIONS,
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

function PreferenceGroup({ title, field, options, draft, onToggle, emptyHint }) {
  if (options.length === 0) {
    if (!emptyHint) return null;
    return (
      <fieldset className="preferences-group">
        <legend>{title}</legend>
        <p className="preferences-status preferences-status-secondary">{emptyHint}</p>
      </fieldset>
    );
  }

  return (
    <fieldset className="preferences-group">
      <legend>{title}</legend>
      <div className="preferences-options">
        {options.map((option) => {
          const active = draft[field].includes(option);
          return (
            <button
              aria-pressed={active}
              className={`preferences-chip${active ? " is-active" : ""}`}
              key={option}
              onClick={() => onToggle(field, option)}
              type="button"
            >
              {option}
            </button>
          );
        })}
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
          <div className="preferences-panel-header">
            <p className="preferences-panel-title">Filter your feed</p>
            <button
              aria-label="Close preferences"
              className="preferences-close"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              ×
            </button>
          </div>

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
            emptyHint="No clubs found yet — more will appear as events are added."
          />
          <PreferenceGroup
            title="Classes"
            field="classes"
            options={options.classes}
            draft={draft}
            onToggle={handleToggle}
            emptyHint="No classes found yet — more will appear as events are added."
          />

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
