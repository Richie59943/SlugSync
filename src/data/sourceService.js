import { supabase } from "../lib/supabaseClient";
import { getCurrentUser } from "./eventService";

// --- 3.3.1 / 3.3.2: CRUD for saved sources ----------------------------------

export async function fetchSources() {
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("sources")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Unable to load your saved sites.");
  }

  return data ?? [];
}

function normalizeUrl(rawUrl) {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) {
    throw new Error("Please enter a URL.");
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("URLs must start with http:// or https://.");
  }

  return parsed.toString();
}

export async function addSource({ url, label }) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("You must be signed in to save a site.");
  }

  const normalizedUrl = normalizeUrl(url);

  const { data, error } = await supabase
    .from("sources")
    .insert({
      user_id: user.id,
      url: normalizedUrl,
      label: label?.trim() || null,
    })
    .select("*")
    .single();

  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      throw new Error("You've already saved that site.");
    }
    throw new Error(error.message || "Unable to save that site.");
  }

  return data;
}

export async function deleteSource(sourceId) {
  if (!sourceId) {
    throw new Error("Missing source id.");
  }

  const user = await getCurrentUser();
  if (!user) {
    throw new Error("You must be signed in to remove a site.");
  }

  const { data, error } = await supabase
    .from("sources")
    .delete()
    .eq("id", sourceId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to remove that site.");
  }

  if (!data) {
    throw new Error("That site could not be removed.");
  }
}

// --- 3.3.3 / 3.3.4 / 3.3.5: ask the edge function to fetch + parse events ---

export async function checkSourceForEvents(source) {
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase.functions.invoke("parse-source", {
    body: { url: source.url, today },
  });

  // On a non-2xx response, supabase-js gives us a generic FunctionsHttpError
  // and puts the actual response on error.context — the JSON body our
  // function returned (e.g. { error: "That site blocked our request..." })
  // is in there, not in `error.message`. Unwrap it so the real reason shows.
  if (error) {
    let messageFromBody = null;
    if (error.context && typeof error.context.json === "function") {
      try {
        const body = await error.context.json();
        messageFromBody = body?.error || null;
      } catch {
        // Response body wasn't JSON (e.g. a raw 500 HTML page) — ignore and
        // fall back to the generic message below.
      }
    }
    throw new Error(messageFromBody || error.message || "Couldn't check that site right now.");
  }

  // The function returns 200 with an "error" field for "no events found",
  // and non-2xx statuses (surfaced here as data === null) for hard failures.
  if (!data) {
    throw new Error("Couldn't check that site right now.");
  }

  if (data.error && (!data.events || data.events.length === 0)) {
    throw new Error(data.error);
  }

  await supabase
    .from("sources")
    .update({ last_checked_at: new Date().toISOString() })
    .eq("id", source.id);

  return data.events ?? [];
}

// --- 3.3.6 / 3.3.7: confirm + save parsed events ----------------------------

export async function saveParsedEvents(events, source) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("You must be signed in to save events.");
  }

  const validEvents = events.filter((event) => event.title && event.date);
  if (validEvents.length === 0) {
    throw new Error("No valid events to save — each event needs at least a title and a date.");
  }

  const payload = validEvents.map((event) => ({
    user_id: user.id,
    title: event.title,
    description: event.description || null,
    event_date: event.date,
    event_time: event.startTime || "00:00",
    event_end_time: event.endTime || null,
    location: event.location || null,
    source: source.label || source.url,
    visibility: "private",
  }));

  const { data, error } = await supabase.from("events").insert(payload).select("*");

  if (error) {
    throw new Error(error.message || "Unable to save these events.");
  }

  return data ?? [];
}
