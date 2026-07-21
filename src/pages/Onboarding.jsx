import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { upsertProfile } from "../data/profileService";
import { INTEREST_CATEGORIES } from "../data/interestOptions";

const MIN_INTERESTS = 3;
const MAX_INTERESTS = 15;

export default function Onboarding() {
  const { session, refreshProfile } = useAuth();
  const userId = session?.user?.id ?? null;
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const atMax = selected.length >= MAX_INTERESTS;
  const belowMin = selected.length < MIN_INTERESTS;
  const canContinue = !belowMin && !saving;

  function toggleInterest(interest) {
    setSelected((prev) => {
      if (prev.includes(interest)) {
        return prev.filter((existing) => existing !== interest);
      }
      if (prev.length >= MAX_INTERESTS) return prev;
      return [...prev, interest];
    });
  }

  async function handleContinue() {
    if (!canContinue) return;
    setSaving(true);
    setError(null);
    try {
      const updatedRow = await upsertProfile(userId, {
        interests: selected,
        onboarding_completed: true,
      });
      await refreshProfile(userId);
      if (!updatedRow) {
        setError("Could not save your interests.");
        setSaving(false);
      }
    } catch (err) {
      setError(err.message || "Could not save your interests.");
      setSaving(false);
    }
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-topbar">
        <span className="onboarding-brand">
          <span className="nav-brand-mark">S</span>
          SlugSync
        </span>
      </div>

      <main className="onboarding-container">
        <header className="onboarding-header">
          <p className="eyebrow">Welcome to SlugSync</p>
          <h1>What are you into?</h1>
          <p className="onboarding-subtitle">
            Pick {MIN_INTERESTS}–{MAX_INTERESTS} interests so we can point you toward events
            you'll actually want to go to.
          </p>
        </header>

        <div className="onboarding-categories">
          {INTEREST_CATEGORIES.map((group) => (
            <section className="onboarding-category" key={group.category}>
              <h2 className="onboarding-category-title">{group.category}</h2>
              <div className="onboarding-grid">
                {group.interests.map((interest) => {
                  const isSelected = selected.includes(interest);
                  const disabled = !isSelected && atMax;
                  return (
                    <button
                      type="button"
                      key={interest}
                      className={`onboarding-chip${isSelected ? " is-selected" : ""}`}
                      onClick={() => toggleInterest(interest)}
                      disabled={disabled}
                      aria-pressed={isSelected}
                    >
                      {interest}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {error && (
          <p className="profile-error onboarding-error" role="alert">
            {error}
          </p>
        )}
      </main>

      <div className="onboarding-footer">
        <div className="onboarding-footer-inner">
          <p className="onboarding-count" aria-live="polite">
            <strong>{selected.length}</strong> of {MAX_INTERESTS} selected
            {belowMin ? ` · pick at least ${MIN_INTERESTS} to continue` : ""}
            {atMax ? " · limit reached" : ""}
          </p>
          <button
            type="button"
            className="btn-primary onboarding-continue"
            onClick={handleContinue}
            disabled={!canContinue}
          >
            {saving ? "Saving…" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
