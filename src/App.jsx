import React, { useEffect, useState } from "react";
import Dashboard from "./pages/Dashboard";

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

  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const route = hash.replace(/^#\/?/, "");

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
          <a href="#/sources" className={route === "sources" ? "is-active" : ""}>
            Sources
          </a>
        </div>
      </nav>

      {route === "calendar" ? (
        <Placeholder
          title="Calendar"
          text="Your AI-managed calendar lands in a later sprint."
        />
      ) : route === "sources" ? (
        <Placeholder
          title="Sources"
          text="Discord and Instagram event sources land in a later sprint."
        />
      ) : (
        <Dashboard />
      )}
    </div>
  );
}

export default App;
