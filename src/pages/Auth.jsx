import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  async function handleSignIn(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);

    setLoading(false);
  }

  async function handleSignUp(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
    } else {
      setMessage("Check your email to confirm your account, then sign in.");
    }

    setLoading(false);
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">Welcome to</p>
        <h1 className="auth-title">SlugSync</h1>
        <p className="auth-subtitle">Sign in or create an account to manage your profile.</p>

        <form className="auth-form" onSubmit={handleSignIn}>
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
              autoComplete="current-password"
              minLength={6}
            />
          </label>

          {error && <p className="auth-error">{error}</p>}
          {message && <p className="auth-message">{message}</p>}

          <div className="auth-actions">
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={loading}
              onClick={handleSignUp}
            >
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
