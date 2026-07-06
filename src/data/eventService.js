import { supabase } from "../lib/supabaseClient";

export async function deleteEvent(eventId) {
  if (!eventId) {
    throw new Error("Missing event id. The event could not be deleted.");
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw new Error(authError.message || "Could not verify your account.");
  }

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
