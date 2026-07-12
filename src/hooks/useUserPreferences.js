import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const EMPTY_PREFERENCES = { clubs: [], classes: [], categories: [] };

// status: "idle" | "loading" | "saving" | "success" | "error"
export function useUserPreferences() {
  const [userId, setUserId] = useState(null);
  const [preferences, setPreferences] = useState(EMPTY_PREFERENCES);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setUserId(session?.user?.id ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!userId) {
      setPreferences(EMPTY_PREFERENCES);
      setStatus("idle");
      setError(null);
      return;
    }

    async function loadPreferences() {
      setStatus("loading");
      setError(null);

      const { data, error: loadError } = await supabase
        .from("user_preferences")
        .select("clubs, classes, categories")
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelled) return;

      if (loadError) {
        setError(loadError.message);
        setStatus("error");
        return;
      }

      setPreferences({
        clubs: data?.clubs ?? [],
        classes: data?.classes ?? [],
        categories: data?.categories ?? [],
      });
      setStatus("idle");
    }

    loadPreferences();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const savePreferences = useCallback(
    async (nextPreferences) => {
      if (!userId) {
        throw new Error("You must be signed in to save preferences.");
      }

      setStatus("saving");
      setError(null);

      const payload = {
        user_id: userId,
        clubs: nextPreferences.clubs ?? [],
        classes: nextPreferences.classes ?? [],
        categories: nextPreferences.categories ?? [],
        updated_at: new Date().toISOString(),
      };

      const { error: saveError } = await supabase
        .from("user_preferences")
        .upsert(payload);

      if (saveError) {
        setError(saveError.message);
        setStatus("error");
        throw new Error(saveError.message);
      }

      setPreferences({
        clubs: payload.clubs,
        classes: payload.classes,
        categories: payload.categories,
      });
      setStatus("success");
    },
    [userId],
  );

  const clearPreferences = useCallback(async () => {
    await savePreferences(EMPTY_PREFERENCES);
  }, [savePreferences]);

  return {
    userId,
    preferences,
    status,
    error,
    savePreferences,
    clearPreferences,
  };
}
