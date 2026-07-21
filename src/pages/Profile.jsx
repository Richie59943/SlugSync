import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Auth from "./Auth";
import ProfileHeader from "../components/profile/ProfileHeader";
import TagList from "../components/profile/TagList";
import PrivacySettings from "../components/profile/PrivacySettings";
import ProfileCompleteness from "../components/profile/ProfileCompleteness";
import InterestPicker from "../components/profile/InterestPicker";
import { useAuth } from "../context/AuthContext";
import {
  fetchProfile,
  upsertProfile,
  uploadAvatarFile,
  removeAvatarFile,
} from "../data/profileService";
import { fetchEvents } from "../data/eventService";
import { fetchGroups } from "../data/groupService";
import { formatEventRow } from "../data/formatEventRow";
import { computeAvailability } from "../data/availability";
import { computeCompleteness } from "../data/profileCompleteness";
import { toTagArray, tagsToInput } from "../lib/tags";
import { initialsFromEmail, initialsFromName } from "../lib/displayName";

const YEAR_OPTIONS = ["Freshman", "Sophomore", "Junior", "Senior", "Graduate", "Other"];

function normalizeProfile(row, userId) {
  return {
    id: userId,
    full_name: row?.full_name || "",
    username: row?.username || "",
    major: row?.major || "",
    year: row?.year || "",
    bio: row?.bio || "",
    avatar_url: row?.avatar_url || null,
    avatar_path: row?.avatar_path || null,
    interests: toTagArray(row?.interests),
    clubs: toTagArray(row?.clubs),
    classes: toTagArray(row?.classes),
    schedule_visibility: row?.schedule_visibility || "friends",
    event_title_visibility: row?.event_title_visibility || "friends",
    classes_visibility: row?.classes_visibility || "friends",
    clubs_visibility: row?.clubs_visibility || "friends",
    allow_friend_requests: row?.allow_friend_requests ?? true,
    allow_group_invites: row?.allow_group_invites ?? true,
  };
}

function toFormState(profile) {
  return {
    ...profile,
    interests: toTagArray(profile.interests),
    clubs: tagsToInput(profile.clubs),
    classes: tagsToInput(profile.classes),
  };
}

function validateForm(form) {
  if (!form.full_name.trim()) {
    return "Please add your name.";
  }
  if (form.username.trim() && !/^[a-zA-Z0-9_.]{3,30}$/.test(form.username.trim())) {
    return "Usernames must be 3-30 characters using letters, numbers, periods, or underscores.";
  }
  if (form.bio && form.bio.length > 500) {
    return "Bio must be 500 characters or fewer.";
  }
  return null;
}

function isUpcoming(row, now) {
  if (!row.event_date) return false;
  const eventDateTime = new Date(`${row.event_date}T${row.event_time || "00:00"}`);
  return eventDateTime.getTime() >= now.getTime();
}

function privacySummaryText(profile) {
  return `Schedule ${profile.schedule_visibility} · Classes ${profile.classes_visibility} · Clubs ${profile.clubs_visibility}`;
}

export default function Profile() {
  const { session, loading: authLoading, refreshProfile: refreshNavProfile } = useAuth();
  const userId = session?.user?.id ?? null;

  const [savedProfile, setSavedProfile] = useState(null);
  const [profileStatus, setProfileStatus] = useState("loading"); // loading | ready | error
  const [profileError, setProfileError] = useState(null);

  const [mode, setMode] = useState("view"); // view | edit
  const [form, setForm] = useState(null);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | success | error
  const [saveError, setSaveError] = useState(null);

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState(null);
  const fileInputRef = useRef(null);

  const [eventsState, setEventsState] = useState({ status: "loading", raw: [], error: null });
  const [groupsState, setGroupsState] = useState({ status: "loading", items: [], error: null });

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    setProfileStatus("loading");
    setProfileError(null);
    try {
      const row = await fetchProfile(userId);
      const normalized = normalizeProfile(row, userId);
      setSavedProfile(normalized);
      setForm(toFormState(normalized));
      setProfileStatus("ready");
    } catch (error) {
      setProfileStatus("error");
      setProfileError(error.message);
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    setEventsState({ status: "loading", raw: [], error: null });

    fetchEvents()
      .then(({ events }) => {
        if (cancelled) return;
        setEventsState({ status: "ready", raw: events, error: null });
      })
      .catch((error) => {
        if (cancelled) return;
        setEventsState({ status: "error", raw: [], error: error.message });
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    setGroupsState({ status: "loading", items: [], error: null });

    fetchGroups()
      .then(({ groups }) => {
        if (cancelled) return;
        setGroupsState({ status: "ready", items: groups, error: null });
      })
      .catch((error) => {
        if (cancelled) return;
        setGroupsState({ status: "error", items: [], error: error.message });
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const upcomingEvents = useMemo(() => {
    if (eventsState.status !== "ready") return [];
    const now = new Date();
    return eventsState.raw
      .filter((row) => isUpcoming(row, now))
      .slice(0, 3)
      .map(formatEventRow);
  }, [eventsState]);

  const availability = useMemo(
    () => computeAvailability(eventsState.raw, new Date()),
    [eventsState],
  );

  const completeness = useMemo(
    () => (savedProfile ? computeCompleteness(savedProfile) : { percent: 0, suggestion: "" }),
    [savedProfile],
  );

  function handleEditClick() {
    setForm(toFormState(savedProfile));
    setSaveState("idle");
    setSaveError(null);
    setAvatarError(null);
    setMode("edit");
  }

  function handleCancel() {
    setForm(toFormState(savedProfile));
    setSaveState("idle");
    setSaveError(null);
    setAvatarError(null);
    setMode("view");
  }

  function handleField(key) {
    return (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  function handleInterestsChange(nextInterests) {
    setForm((prev) => ({ ...prev, interests: nextInterests }));
  }

  function handlePrivacyChange(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();

    const validationError = validateForm(form);
    if (validationError) {
      setSaveState("error");
      setSaveError(validationError);
      return;
    }

    setSaveState("saving");
    setSaveError(null);

    const payload = {
      full_name: form.full_name.trim() || null,
      username: form.username.trim() || null,
      major: form.major.trim() || null,
      year: form.year || null,
      bio: form.bio.trim() || null,
      interests: toTagArray(form.interests),
      clubs: toTagArray(form.clubs),
      classes: toTagArray(form.classes),
      schedule_visibility: form.schedule_visibility,
      event_title_visibility: form.event_title_visibility,
      classes_visibility: form.classes_visibility,
      clubs_visibility: form.clubs_visibility,
      allow_friend_requests: form.allow_friend_requests,
      allow_group_invites: form.allow_group_invites,
    };

    try {
      const updatedRow = await upsertProfile(userId, payload);
      const normalized = normalizeProfile(updatedRow, userId);
      setSavedProfile(normalized);
      setForm(toFormState(normalized));
      setSaveState("success");
      setMode("view");
      refreshNavProfile(userId);
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (error) {
      setSaveState("error");
      setSaveError(error.message);
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setAvatarError(null);
    setAvatarBusy(true);

    let uploaded;
    try {
      uploaded = await uploadAvatarFile(userId, file);
    } catch (error) {
      setAvatarError(error.message);
      setAvatarBusy(false);
      return;
    }

    const previousPath = savedProfile.avatar_path;

    try {
      const updatedRow = await upsertProfile(userId, {
        avatar_url: uploaded.publicUrl,
        avatar_path: uploaded.path,
      });
      const normalized = normalizeProfile(updatedRow, userId);
      setSavedProfile(normalized);
      setForm((prev) => ({
        ...prev,
        avatar_url: normalized.avatar_url,
        avatar_path: normalized.avatar_path,
      }));
      await refreshNavProfile(userId);
      if (previousPath && previousPath !== uploaded.path) {
        await removeAvatarFile(previousPath);
      }
    } catch (error) {
      await removeAvatarFile(uploaded.path);
      setAvatarError(error.message || "Could not save your new photo.");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleRemovePhoto() {
    if (!savedProfile?.avatar_url) return;
    setAvatarError(null);
    setAvatarBusy(true);
    const pathToRemove = savedProfile.avatar_path;

    try {
      const updatedRow = await upsertProfile(userId, {
        avatar_url: null,
        avatar_path: null,
      });
      if (pathToRemove) await removeAvatarFile(pathToRemove);
      const normalized = normalizeProfile(updatedRow, userId);
      setSavedProfile(normalized);
      setForm((prev) => ({ ...prev, avatar_url: null, avatar_path: null }));
      await refreshNavProfile(userId);
    } catch (error) {
      setAvatarError(error.message || "Could not remove your photo.");
    } finally {
      setAvatarBusy(false);
    }
  }

  if (authLoading) {
    return (
      <main className="profile-page">
        <p className="profile-loading">Loading…</p>
      </main>
    );
  }

  if (!session) {
    return <Auth />;
  }

  if (profileStatus === "loading" || !savedProfile || !form) {
    return (
      <main className="profile-page">
        <p className="profile-loading">Loading your profile…</p>
      </main>
    );
  }

  if (profileStatus === "error") {
    return (
      <main className="profile-page">
        <div className="profile-container">
          <p className="profile-error" role="alert">
            Couldn't load your profile: {profileError}
          </p>
          <button
            type="button"
            className="btn-secondary"
            style={{ width: "auto" }}
            onClick={loadProfile}
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  const initials = savedProfile.full_name
    ? initialsFromName(savedProfile.full_name)
    : initialsFromEmail(session.user.email);

  return (
    <main className="profile-page">
      <div className="profile-container">
        <ProfileHeader
          profile={savedProfile}
          initials={initials}
          mode={mode}
          onEditClick={handleEditClick}
          fileInputRef={fileInputRef}
          onFileChange={handleFileChange}
          onUploadClick={() => fileInputRef.current?.click()}
          onRemoveClick={handleRemovePhoto}
          avatarBusy={avatarBusy}
          avatarError={avatarError}
        />

        {mode === "view" ? (
          <div className="profile-view-layout">
            <div className="profile-main-column">
              <div className="profile-card">
                <h2 className="profile-card-title">About</h2>
                {savedProfile.bio ? (
                  <p className="profile-bio-text">{savedProfile.bio}</p>
                ) : (
                  <p className="empty-state profile-empty-inline">No bio yet.</p>
                )}
              </div>

              <div className="profile-card">
                <h2 className="profile-card-title">Interests</h2>
                <TagList tags={savedProfile.interests} emptyText="No interests added yet." />
              </div>

              <div className="profile-card">
                <h2 className="profile-card-title">Clubs</h2>
                <TagList tags={savedProfile.clubs} emptyText="No clubs added yet." />
              </div>

              <div className="profile-card">
                <h2 className="profile-card-title">Classes</h2>
                <TagList tags={savedProfile.classes} emptyText="No classes added yet." />
              </div>
            </div>

            <aside className="profile-sidebar-column">
              <div className="panel profile-sidebar-card">
                <div className="sidebar-card-title">Availability</div>
                {eventsState.status === "loading" && (
                  <p className="empty-state">Loading…</p>
                )}
                {eventsState.status === "error" && (
                  <p className="empty-state">Couldn't load your calendar.</p>
                )}
                {eventsState.status === "ready" &&
                  (availability === null ? (
                    <p className="empty-state">
                      Availability will appear once calendar events are added.
                    </p>
                  ) : availability.none ? (
                    <p className="empty-state">No open windows in the next two days.</p>
                  ) : (
                    <p className="availability-summary-text">{availability.label}</p>
                  ))}
              </div>

              <div className="panel profile-sidebar-card">
                <div className="sidebar-card-title">Upcoming events</div>
                {eventsState.status === "loading" && (
                  <p className="empty-state">Loading…</p>
                )}
                {eventsState.status === "error" && (
                  <p className="empty-state">Couldn't load your events.</p>
                )}
                {eventsState.status === "ready" && upcomingEvents.length === 0 && (
                  <p className="empty-state">No upcoming events yet.</p>
                )}
                {upcomingEvents.map((event) => (
                  <div className="profile-upcoming-event" key={event.id}>
                    <strong>{event.title}</strong>
                    <span>
                      {event.date} · {event.time}
                    </span>
                  </div>
                ))}
                <a className="btn-secondary profile-sidebar-link" href="#/calendar">
                  Open Calendar
                </a>
              </div>

              <div className="panel profile-sidebar-card">
                <div className="sidebar-card-title">Groups</div>
                {groupsState.status === "loading" && (
                  <p className="empty-state">Loading…</p>
                )}
                {groupsState.status === "error" && (
                  <p className="empty-state">Couldn't load your groups.</p>
                )}
                {groupsState.status === "ready" && groupsState.items.length === 0 && (
                  <p className="empty-state">You're not in any groups yet.</p>
                )}
                {groupsState.items.map((group) => (
                  <div className="profile-group-row" key={group.id}>
                    <span>{group.name}</span>
                    <span className="profile-group-meta">
                      {group.members.length} member{group.members.length === 1 ? "" : "s"}
                    </span>
                  </div>
                ))}
                <a className="btn-secondary profile-sidebar-link" href="#/friends">
                  Open Friends
                </a>
              </div>

              <ProfileCompleteness
                percent={completeness.percent}
                suggestion={completeness.suggestion}
                privacyNote={privacySummaryText(savedProfile)}
              />
            </aside>
          </div>
        ) : (
          <form className="profile-form" onSubmit={handleSave}>
            <div className="profile-columns">
              <div className="profile-card">
                <h2 className="profile-card-title">Personal info</h2>

                <div className="profile-row">
                  <label className="profile-label">
                    Full Name
                    <input
                      className="profile-input"
                      type="text"
                      placeholder="Jane Slug"
                      value={form.full_name}
                      onChange={handleField("full_name")}
                      required
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
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="profile-label">
                  Email
                  <input
                    className="profile-input"
                    type="email"
                    value={session.user.email}
                    readOnly
                  />
                </label>

                <label className="profile-label">
                  Bio
                  <textarea
                    className="profile-input profile-textarea"
                    placeholder="Tell your fellow slugs a bit about yourself…"
                    value={form.bio}
                    onChange={handleField("bio")}
                    rows={3}
                    maxLength={500}
                  />
                </label>
              </div>

              <div className="profile-card">
                <h2 className="profile-card-title">Involvement</h2>

                <label className="profile-label">
                  Interests
                  <span className="profile-hint">
                    Search and select from the preset list.
                  </span>
                </label>
                <InterestPicker value={form.interests} onChange={handleInterestsChange} />

                <label className="profile-label">
                  Clubs
                  <span className="profile-hint">
                    Comma-separated, e.g. Robotics Club, Chess Club
                  </span>
                  <input
                    className="profile-input"
                    type="text"
                    placeholder="Robotics Club, Chess Club"
                    value={form.clubs}
                    onChange={handleField("clubs")}
                  />
                </label>
                {toTagArray(form.clubs).length > 0 && (
                  <TagList tags={toTagArray(form.clubs)} emptyText="" />
                )}

                <label className="profile-label">
                  Classes
                  <span className="profile-hint">
                    Comma-separated, e.g. CSE 101, MATH 19A
                  </span>
                  <input
                    className="profile-input"
                    type="text"
                    placeholder="CSE 101, MATH 19A"
                    value={form.classes}
                    onChange={handleField("classes")}
                  />
                </label>
                {toTagArray(form.classes).length > 0 && (
                  <TagList tags={toTagArray(form.classes)} emptyText="" />
                )}
              </div>
            </div>

            <PrivacySettings values={form} onChange={handlePrivacyChange} />

            {saveState === "error" && saveError && (
              <p className="profile-error" role="alert">
                {saveError}
              </p>
            )}

            <div className="profile-actions">
              <button
                type="submit"
                className="btn-primary"
                style={{ width: "auto" }}
                disabled={saveState === "saving"}
              >
                {saveState === "saving" ? "Saving…" : "Save Changes"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ width: "auto" }}
                onClick={handleCancel}
                disabled={saveState === "saving"}
              >
                Cancel
              </button>
              {saveState === "success" && (
                <span className="profile-saved-badge">Saved!</span>
              )}
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
