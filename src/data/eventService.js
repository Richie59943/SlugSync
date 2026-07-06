import { supabase } from "../lib/supabaseClient";

export async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message || "Could not verify your account.");
  }

  return user;
}

export async function fetchEvents() {
  const user = await getCurrentUser();

  if (!user) {
    return { events: [], user: null };
  }

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", user.id)
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true });

  if (error) {
    throw new Error(error.message || "Unable to load events.");
  }

  return { events: data ?? [], user };
}

export async function createEvent(eventInput) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("You must be signed in to create an event.");
  }

  const payload = {
    user_id: user.id,
    title: eventInput.title,
    description: eventInput.description || null,
    event_date: eventInput.eventDate,
    event_time: eventInput.startTime,
    event_end_time: eventInput.endTime || null,
    location: eventInput.location || null,
    source: eventInput.source || "manual",
  };

  const { data, error } = await supabase
    .from("events")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message || "Unable to create this event.");
  }

  return data;
}

export async function updateEvent(eventId, eventInput) {
  if (!eventId) {
    throw new Error("Missing event id. The event could not be updated.");
  }

  const user = await getCurrentUser();

  if (!user) {
    throw new Error("You must be signed in to edit an event.");
  }

  const payload = {
    title: eventInput.title,
    description: eventInput.description || null,
    event_date: eventInput.eventDate,
    event_time: eventInput.startTime,
    event_end_time: eventInput.endTime || null,
    location: eventInput.location || null,
  };

  const { data, error } = await supabase
    .from("events")
    .update(payload)
    .eq("id", eventId)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to update this event.");
  }

  if (!data) {
    throw new Error(
      "This event was not updated because it does not belong to your account.",
    );
  }

  return data;
}

export async function deleteEvent(eventId) {
  if (!eventId) {
    throw new Error("Missing event id. The event could not be deleted.");
  }

  const user = await getCurrentUser();

  if (!user) {
    throw new Error("You must be signed in to delete an event.");
  }

  const { data, error } = await supabase
    .from("events")
    .delete()
    .eq("id", eventId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to delete this event.");
  }

  if (!data) {
    throw new Error(
      "This event was not deleted because it does not belong to your account.",
    );
  }

  return data;
}
