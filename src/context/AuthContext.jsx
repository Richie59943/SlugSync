import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(undefined);

// Minimal shared slice of the profiles row that other pieces of the app (the
// navbar avatar, for example) need to react to without re-fetching the whole
// profile form. Profile.jsx remains the source of truth for editing.
async function fetchProfileSlice(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("avatar_url, full_name, username, onboarding_completed")
    .eq("id", userId)
    .maybeSingle();

  if (error) return null;
  return data;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const refreshProfile = useCallback(async (userId) => {
    const id = userId ?? session?.user?.id;
    if (!id) {
      setProfile(null);
      return;
    }
    const slice = await fetchProfileSlice(id);
    setProfile(slice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!session?.user?.id) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    fetchProfileSlice(session.user.id).then((slice) => {
      if (cancelled) return;
      setProfile(slice);
      setProfileLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  async function signOut() {
    await supabase.auth.signOut();
  }

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    signOut,
    profile,
    profileLoading,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
