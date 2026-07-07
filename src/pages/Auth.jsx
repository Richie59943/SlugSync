import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Auth() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const isSignIn = mode === "signin";

  function switchMode(nextMode) {
    setMode(nextMode);
    setError(null);
    setMessage(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (isSignIn) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setMessage("Check your email to confirm your account, then sign in.");
      }
    }

    setLoading(false);
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            role="tab"
            aria-selected={isSignIn}
            className={`auth-tab${isSignIn ? " is-active" : ""}`}
            onClick={() => switchMode("signin")}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isSignIn}
            className={`auth-tab${!isSignIn ? " is-active" : ""}`}
            onClick={() => switchMode("signup")}
          >
            Create Account
          </button>
        </div>

        <p className="eyebrow">{isSignIn ? "Account login" : "New account"}</p>
        <h1 className="auth-title">{isSignIn ? "Welcome back" : "Create your account"}</h1>
        <p className="auth-subtitle">
          {isSignIn
            ? "Sign in to manage your SlugSync profile."
            : "Set up your SlugSync profile and start building your schedule."}
        </p>

        {!isSignIn && (
          <ul className="auth-checklist">
            <li>Save your profile</li>
            <li>Track your clubs and classes</li>
            <li>Build your event schedule</li>
          </ul>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-label">
            Email
            <input
              className="auth-input"
              type="email"
              placeholder="you@ucsc.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>

          <label className="auth-label">
            Password
            <input
              className="auth-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={isSignIn ? "current-password" : "new-password"}
              minLength={6}
            />
          </label>

          {error && <p className="auth-error">{error}</p>}
          {message && <p className="auth-message">{message}</p>}

          <div className="auth-actions">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading
                ? isSignIn
                  ? "Signing in…"
                  : "Creating account…"
                : isSignIn
                ? "Sign In"
                : "Create Account"}
            </button>
          </div>
        </form>

        <p className="auth-switch">
          {isSignIn ? (
            <>
              New to SlugSync?{" "}
              <button type="button" className="auth-switch-link" onClick={() => switchMode("signup")}>
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button type="button" className="auth-switch-link" onClick={() => switchMode("signin")}>
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
