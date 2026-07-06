import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import Auth from "./Auth";

const YEAR_OPTIONS = ["Freshman", "Sophomore", "Junior", "Senior", "Graduate", "Other"];

function arrayToInput(arr) {
  return Array.isArray(arr) ? arr.join(", ") : "";
}

function inputToArray(str) {
  return str
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function Profile() {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    full_name: "",
    username: "",
    major: "",
    year: "",
    bio: "",
    clubs: "",
    classes: "",
  });
  const [pageState, setPageState] = useState("idle"); // idle | saving | saved | error
  const [errorMsg, setErrorMsg] = useState(null);

  // Track auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch profile when session is known
  const fetchProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      setErrorMsg("Could not load profile: " + error.message);
      return;
    }

    if (data) {
      setProfile(data);
      setForm({
        full_name: data.full_name || "",
        username: data.username || "",
        major: data.major || "",
        year: data.year || "",
        bio: data.bio || "",
        clubs: arrayToInput(data.clubs),
        classes: arrayToInput(data.classes),
      });
    }
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      fetchProfile(session.user.id);
    }
  }, [session, fetchProfile]);

  async function handleSave(e) {
    e.preventDefault();
    setPageState("saving");
    setErrorMsg(null);

    const userId = session.user.id;
    const payload = {
      id: userId,
      full_name: form.full_name || null,
      username: form.username || null,
      major: form.major || null,
      year: form.year || null,
      bio: form.bio || null,
      clubs: inputToArray(form.clubs),
      classes: inputToArray(form.classes),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("profiles").upsert(payload);

    if (error) {
      setPageState("error");
      setErrorMsg(error.message);
    } else {
      setPageState("saved");
      await fetchProfile(userId);
      setTimeout(() => setPageState("idle"), 2500);
    }
  }

  function handleField(key) {
    return (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  // Still resolving session
  if (session === undefined) {
    return (
      <main className="profile-page">
        <div className="profile-loading">Loading…</div>
      </main>
    );
  }

  // Not logged in
  if (!session) {
    return <Auth />;
  }

  return (
    <main className="profile-page">
      <div className="profile-container">
        <div className="profile-header">
          <div>
            <p className="eyebrow">Your Account</p>
            <h1 className="profile-title">Profile</h1>
            <p className="profile-email">{session.user.email}</p>
          </div>
          <button type="button" className="btn-signout" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>

        <form className="profile-form" onSubmit={handleSave}>
          <div className="profile-section-label">Personal Info</div>

          <div className="profile-row">
            <label className="profile-label">
              Full Name
              <input
                className="profile-input"
                type="text"
                placeholder="Jane Slug"
                value={form.full_name}
                onChange={handleField("full_name")}
              />
            </label>
            <label className="profile-label">
              Username
              <input
                className="profile-input"
                type="text"
                placeholder="janeslug"
                value={form.username}
                onChange={handleField("username")}
              />
            </label>
          </div>

          <div className="profile-row">
            <label className="profile-label">
              Major
              <input
                className="profile-input"
                type="text"
                placeholder="Computer Science"
                value={form.major}
                onChange={handleField("major")}
              />
            </label>
            <label className="profile-label">
              Year
              <select
                className="profile-input"
                value={form.year}
                onChange={handleField("year")}
              >
                <option value="">Select year…</option>
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="profile-label">
            Bio
            <textarea
              className="profile-input profile-textarea"
              placeholder="Tell your fellow slugs a bit about yourself…"
              value={form.bio}
              onChange={handleField("bio")}
              rows={3}
            />
          </label>

          <div className="profile-section-label">Involvement</div>

          <label className="profile-label">
            Clubs
            <span className="profile-hint">Comma-separated, e.g. Robotics Club, Chess Club</span>
            <input
              className="profile-input"
              type="text"
              placeholder="Robotics Club, Chess Club"
              value={form.clubs}
              onChange={handleField("clubs")}
            />
          </label>

          <label className="profile-label">
            Classes
            <span className="profile-hint">Comma-separated, e.g. CSE 101, MATH 19A</span>
            <input
              className="profile-input"
              type="text"
              placeholder="CSE 101, MATH 19A"
              value={form.classes}
              onChange={handleField("classes")}
            />
          </label>

          {errorMsg && <p className="profile-error">{errorMsg}</p>}

          <div className="profile-actions">
            <button
              type="submit"
              className="btn-primary"
              disabled={pageState === "saving"}
            >
              {pageState === "saving" ? "Saving…" : "Save Profile"}
            </button>
            {pageState === "saved" && (
              <span className="profile-saved-badge">Saved!</span>
            )}
          </div>
        </form>

        {profile && (
          <div className="profile-preview">
            <div className="profile-section-label">Preview</div>
            <div className="profile-preview-card">
              <div className="profile-avatar">
                {(form.full_name || session.user.email).charAt(0).toUpperCase()}
              </div>
              <div className="profile-preview-info">
                <strong>{form.full_name || "(no name)"}</strong>
                {form.username && <span className="profile-preview-username">@{form.username}</span>}
                {(form.major || form.year) && (
                  <span className="profile-preview-meta">
                    {[form.major, form.year].filter(Boolean).join(" · ")}
                  </span>
                )}
                {form.bio && <p className="profile-preview-bio">{form.bio}</p>}
                {form.clubs && (
                  <div className="profile-preview-tags">
                    {inputToArray(form.clubs).map((c) => (
                      <span key={c} className="profile-tag">{c}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
