import React, { useEffect, useState } from "react";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Calendar from "./pages/Calendar";
import Friends from "./pages/Friends";
import Auth from "./pages/Auth";
import { useAuth } from "./context/AuthContext";
import { QuickAddProvider, useQuickAdd } from "./context/QuickAddContext";
import { initialsFromEmail } from "./lib/displayName";

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

function Nav({ route, email, onSignOut }) {
  const { openAdd } = useQuickAdd();

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

        <a className="nav-avatar" href="#/profile" title="Profile">
          {initialsFromEmail(email)}
        </a>
      </div>
    </nav>
  );
}

function App() {
  const [hash, setHash] = useState(window.location.hash);
  const { session, loading, signOut } = useAuth();

  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const route = hash.replace(/^#\/?/, "");

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

  return (
    <QuickAddProvider>
      <div className="app-shell">
        <Nav route={route} email={session.user?.email} onSignOut={signOut} />

        {route === "calendar" ? (
          <Calendar />
        ) : route === "friends" ? (
          <Friends />
        ) : route === "sources" ? (
          <Placeholder
            title="Sources"
            text="Discord and Instagram event sources land in a later sprint."
          />
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
