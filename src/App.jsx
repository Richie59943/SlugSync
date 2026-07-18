import React, { useEffect, useState } from "react";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Calendar from "./pages/Calendar";
import Friends from "./pages/Friends";
import Auth from "./pages/Auth";
import { useAuth } from "./context/AuthContext";

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
    <div className="app-shell">
      <nav className="navbar" aria-label="Main navigation">
        <a className="brand" href="#/">
          SlugSync
        </a>
        <div className="nav-links">
          <a href="#/" className={route === "" ? "is-active" : ""}>
            Dashboard
          </a>
          <a href="#/calendar" className={route === "calendar" ? "is-active" : ""}>
            Calendar
          </a>
          <a href="#/friends" className={route === "friends" ? "is-active" : ""}>
            Friends
          </a>
          <a href="#/sources" className={route === "sources" ? "is-active" : ""}>
            Sources
          </a>
          <a href="#/profile" className={route === "profile" ? "is-active" : ""}>
            Profile
          </a>
        </div>
        <button type="button" className="btn-signout" onClick={signOut}>
          Sign Out
        </button>
      </nav>

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
  );
}

export default App;
