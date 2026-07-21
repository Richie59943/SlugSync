import React, { useMemo, useRef, useState } from "react";
import { INTEREST_CATEGORIES } from "../../data/interestOptions";

const MAX_INTERESTS = 15;

export default function InterestPicker({ value, onChange }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef(null);

  const atLimit = value.length >= MAX_INTERESTS;

  const selectedLower = useMemo(
    () => new Set(value.map((interest) => interest.toLowerCase())),
    [value],
  );

  const filteredGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return INTEREST_CATEGORIES.map((group) => ({
      category: group.category,
      interests: group.interests.filter((interest) => {
        if (selectedLower.has(interest.toLowerCase())) return false;
        if (!needle) return true;
        return interest.toLowerCase().includes(needle);
      }),
    })).filter((group) => group.interests.length > 0);
  }, [query, selectedLower]);

  const flatOptions = useMemo(
    () => filteredGroups.flatMap((group) => group.interests),
    [filteredGroups],
  );

  function addInterest(interest) {
    if (atLimit) return;
    if (selectedLower.has(interest.toLowerCase())) return;
    onChange([...value, interest]);
    setQuery("");
    setHighlightedIndex(0);
    inputRef.current?.focus();
  }

  function removeInterest(interest) {
    onChange(value.filter((existing) => existing !== interest));
  }

  function handleKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlightedIndex((i) => Math.min(i + 1, flatOptions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = flatOptions[highlightedIndex];
      if (target) addInterest(target);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && !query && value.length > 0) {
      removeInterest(value[value.length - 1]);
    }
  }

  return (
    <div className="interest-picker">
      {value.length > 0 && (
        <div className="profile-tag-row">
          {value.map((interest) => (
            <span className="profile-tag interest-chip" key={interest}>
              {interest}
              <button
                type="button"
                className="interest-chip-remove"
                aria-label={`Remove ${interest}`}
                onClick={() => removeInterest(interest)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {atLimit ? (
        <p className="interest-picker-limit-message" role="status">
          You can pick up to {MAX_INTERESTS} interests. Remove one to add another.
        </p>
      ) : (
        <div className="interest-picker-input-wrap">
          <input
            ref={inputRef}
            className="profile-input"
            type="text"
            placeholder="Type to search interests…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setHighlightedIndex(0);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
          />

          {open && flatOptions.length > 0 && (
            <div className="interest-picker-dropdown" role="listbox">
              {filteredGroups.map((group) => (
                <div className="interest-picker-group" key={group.category}>
                  <div className="interest-picker-group-label">{group.category}</div>
                  {group.interests.map((interest) => {
                    const optionIndex = flatOptions.indexOf(interest);
                    return (
                      <button
                        type="button"
                        key={interest}
                        role="option"
                        aria-selected={optionIndex === highlightedIndex}
                        className={
                          "interest-picker-option" +
                          (optionIndex === highlightedIndex ? " is-highlighted" : "")
                        }
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setHighlightedIndex(optionIndex)}
                        onClick={() => addInterest(interest)}
                      >
                        {interest}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {open && flatOptions.length === 0 && (
            <div className="interest-picker-dropdown">
              <p className="interest-picker-empty">No matching interests.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
