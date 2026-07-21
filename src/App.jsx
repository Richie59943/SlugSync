import React, { useEffect, useRef, useState } from "react";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Calendar from "./pages/Calendar";
import Friends from "./pages/Friends";
import Sources from "./pages/Sources";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import { useAuth } from "./context/AuthContext";
import { QuickAddProvider, useQuickAdd } from "./context/QuickAddContext";
import { useTheme } from "./context/ThemeContext";
import { initialsFromEmail, initialsFromName } from "./lib/displayName";

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function ThemeToggle() {
  const { themePreference, resolvedTheme, setThemePreference } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function selectTheme(value) {
    setThemePreference(value);
    setOpen(false);
  }

  const currentLabel =
    THEME_OPTIONS.find((option) => option.value === themePreference)?.label ?? "System";

  return (
    <div className="theme-toggle" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Theme: ${currentLabel}. Change theme`}
        className="theme-toggle-button"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span aria-hidden="true">{resolvedTheme === "dark" ? "🌙" : "☀️"}</span>
      </button>

      {open && (
        <div aria-label="Theme options" className="theme-toggle-menu" role="menu">
          {THEME_OPTIONS.map((option) => (
            <button
              aria-checked={themePreference === option.value}
              className={`theme-toggle-option${
                themePreference === option.value ? " is-active" : ""
              }`}
              key={option.value}
              onClick={() => selectTheme(option.value)}
              role="menuitemradio"
              type="button"
            >
              {option.label}
              {themePreference === option.value && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const NAV_ITEMS = [
  { key: "", label: "Dashboard" },
  { key: "calendar", label: "Calendar" },
  { key: "friends", label: "Friends" },
  { key: "sources", label: "Sources" },
  { key: "profile", label: "Profile" },
];

function Placeholder({ title, text }) {
  return (
    <main className="dashboard">
      <section className="welcome-section">
        <div>
          <p className="eyebrow">Coming soon</p>
          <h1>{title}</h1>
          <p>{text}</p>
        </div>
      </section>
    </main>
  );
}

function Nav({ route, email, profile, onSignOut }) {
  const { openAdd } = useQuickAdd();
  const initials = profile?.full_name
    ? initialsFromName(profile.full_name)
    : initialsFromEmail(email);

  function handleAddEvent() {
    // Reuses Dashboard's/Calendar's own add-event flow when either is
    // mounted; otherwise just take the user to Dashboard, which has its
    // own "+ Add Event" entry point.
    if (!openAdd() && route !== "") {
      window.location.hash = "";
    }
  }

  return (
    <nav className="navbar" aria-label="Main navigation">
      <div className="navbar-inner">
        <a className="nav-brand" href="#/">
          <span className="nav-brand-mark">S</span>
          <span className="nav-brand-name">SlugSync</span>
        </a>

        <div className="nav-links">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.key}
              href={`#/${item.key}`}
              className={`nav-link${route === item.key ? " is-active" : ""}`}
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="nav-spacer" />

        <button type="button" className="nav-add-button" onClick={handleAddEvent}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          <span className="nav-add-label">Add event</span>
        </button>

        <button type="button" className="btn-signout nav-signout" onClick={onSignOut}>
          Sign Out
        </button>

        <ThemeToggle />

        <a className="nav-avatar" href="#/profile" title="Profile">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="nav-avatar-img" />
          ) : (
            initials
          )}
        </a>
      </div>
    </nav>
  );
}

function App() {
  const [hash, setHash] = useState(window.location.hash);
  const { session, loading, signOut, profile, profileLoading } = useAuth();

  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const route = hash.replace(/^#\/?/, "");
  const groupCalendarMatch =
    route.match(/^calendar\/groups\/([^/]+)$/) ??
    route.match(/^groups\/([^/]+)\/calendar$/);
  const groupCalendarId = groupCalendarMatch?.[1] ?? null;

  if (loading) {
    return (
      <div className="app-shell">
        <p className="empty-state">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app-shell">
        <Auth />
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div className="app-shell">
        <p className="empty-state">Loading…</p>
      </div>
    );
  }

  if (!profile?.onboarding_completed) {
    return (
      <div className="app-shell">
        <Onboarding />
      </div>
    );
  }

  return (
    <QuickAddProvider>
      <div className="app-shell">
        <Nav route={route} email={session.user?.email} profile={profile} onSignOut={signOut} />

        {route === "calendar" ? (
          <Calendar />
        ) : groupCalendarId ? (
          <Calendar groupId={groupCalendarId} />
        ) : route === "friends" ? (
          <Friends />
        ) : route === "sources" ? (
          <Sources />
        ) : route === "profile" ? (
          <Profile />
        ) : (
          <Dashboard />
        )}
      </div>
    </QuickAddProvider>
  );
}

export default App;
