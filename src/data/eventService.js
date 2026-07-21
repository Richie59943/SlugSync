import { supabase } from "../lib/supabaseClient";
import {
  EVENT_VISIBILITY,
  normalizeEventVisibility,
} from "./eventVisibility";

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

async function fetchGroupEventLinks(groupId = null) {
  let query = supabase
    .from("group_events")
    .select(
      `
        group_id,
        event_id,
        shared_by,
        groups (
          id,
          name
        ),
        events (
          *
        )
      `,
    )
    .order("created_at", { ascending: false });

  if (groupId) {
    query = query.eq("group_id", groupId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || "Unable to load group events.");
  }

  return data ?? [];
}

export async function fetchCalendarEvents({ groupId = null } = {}) {
  const { events: personalEvents, user } = await fetchEvents();

  if (!user) {
    return {
      events: [],
      user: null,
      selectedGroup: null,
    };
  }

  const groupLinks = await fetchGroupEventLinks(groupId);
  const calendarEventsById = new Map();

  if (!groupId) {
    personalEvents.forEach((event) => {
      calendarEventsById.set(event.id, {
        ...event,
        calendarScope: "personal",
        groupId: null,
        groupName: null,
        groupShares: [],
      });
    });
  }

  groupLinks.forEach((link) => {
    if (!link.events) return;

    const existing = calendarEventsById.get(link.event_id);
    const groupShare = {
      groupId: link.group_id,
      groupName: link.groups?.name ?? "Group",
      sharedBy: link.shared_by,
    };
    const groupShares = [...(existing?.groupShares ?? []), groupShare];
    const groupName = groupShares.map((share) => share.groupName).join(", ");

    calendarEventsById.set(link.event_id, {
      ...(existing ?? link.events),
      ...link.events,
      calendarScope: "group",
      groupId: groupId ? link.group_id : groupShares[0]?.groupId ?? link.group_id,
      groupName,
      sharedBy: link.shared_by,
      groupShares,
    });
  });

  const selectedGroup = groupId
    ? {
        id: groupId,
        name: groupLinks[0]?.groups?.name ?? null,
      }
    : null;

  return {
    events: [...calendarEventsById.values()],
    user,
    selectedGroup,
  };
}

// Community event reads are still enforced by RLS. Private events only come
// through fetchEvents(), scoped to the authenticated owner.
export async function fetchCommunityEvents() {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("visibility", EVENT_VISIBILITY.COMMUNITY)
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true });

  if (error) {
    throw new Error(error.message || "Unable to load community events.");
  }

  return data ?? [];
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
    visibility: normalizeEventVisibility(eventInput.visibility),
    color: eventInput.color || null,
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

export async function shareEventWithGroup(eventId, groupId) {
  if (!eventId || !groupId) {
    throw new Error("Missing event or group. The event could not be shared.");
  }

  const user = await getCurrentUser();

  if (!user) {
    throw new Error("You must be signed in to share an event with a group.");
  }

  const { data, error } = await supabase
    .from("group_events")
    .insert({
      event_id: eventId,
      group_id: groupId,
      shared_by: user.id,
    })
    .select("group_id, event_id, shared_by")
    .single();

  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      throw new Error("This event is already shared with that group.");
    }
    throw new Error(error.message || "Unable to share this event.");
  }

  return data;
}

export async function fetchEventGroupIds(eventId) {
  if (!eventId) {
    throw new Error("Missing event id. Group sharing could not be loaded.");
  }

  const { data, error } = await supabase
    .from("group_events")
    .select("group_id")
    .eq("event_id", eventId);

  if (error) {
    throw new Error(error.message || "Unable to load this event's groups.");
  }

  return (data ?? []).map((row) => row.group_id);
}

export async function syncEventGroups(eventId, selectedGroupIds) {
  if (!eventId) {
    throw new Error("Missing event id. Group sharing could not be updated.");
  }

  const user = await getCurrentUser();

  if (!user) {
    throw new Error("You must be signed in to update group sharing.");
  }

  const requestedGroupIds = [...new Set(selectedGroupIds ?? [])].filter(Boolean);
  const currentGroupIds = await fetchEventGroupIds(eventId);
  const currentSet = new Set(currentGroupIds);
  const requestedSet = new Set(requestedGroupIds);
  const groupIdsToAdd = requestedGroupIds.filter((groupId) => !currentSet.has(groupId));
  const groupIdsToRemove = currentGroupIds.filter((groupId) => !requestedSet.has(groupId));

  if (groupIdsToAdd.length > 0) {
    const rows = groupIdsToAdd.map((groupId) => ({
      event_id: eventId,
      group_id: groupId,
      shared_by: user.id,
    }));

    const { error } = await supabase.from("group_events").insert(rows);

    if (error) {
      throw new Error(error.message || "Unable to share this event with the selected groups.");
    }
  }

  if (groupIdsToRemove.length > 0) {
    const { error } = await supabase
      .from("group_events")
      .delete()
      .eq("event_id", eventId)
      .in("group_id", groupIdsToRemove);

    if (error) {
      throw new Error(error.message || "Unable to remove this event from the selected groups.");
    }
  }

  return requestedGroupIds;
}

export async function removeEventFromGroup(eventId, groupId) {
  if (!eventId || !groupId) {
    throw new Error("Missing event or group. The event could not be removed.");
  }

  const { error } = await supabase
    .from("group_events")
    .delete()
    .eq("event_id", eventId)
    .eq("group_id", groupId);

  if (error) {
    throw new Error(error.message || "Unable to remove this event from the group.");
  }
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
    visibility: normalizeEventVisibility(eventInput.visibility),
    color: eventInput.color || null,
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
