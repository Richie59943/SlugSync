import { supabase } from "../lib/supabaseClient";
import { getCurrentUser } from "./eventService";

// %, commas, and parens break the PostgREST .or() filter syntax
function sanitizeQuery(query) {
  return query.replace(/[%,()]/g, "").trim();
}

export async function searchUsers(query) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("You must be signed in to search for friends.");
  }

  const q = sanitizeQuery(query);
  if (!q) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, major, year")
    .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
    .neq("id", user.id)
    .limit(10);

  if (error) {
    throw new Error(error.message || "Unable to search for users.");
  }

  return data ?? [];
}

// Returns { friends, incoming, outgoing }, each an array of
// { friendshipId, profile }. Two queries: friendships rows, then the
// counterpart profiles via .in() (no PostgREST embed — the FK targets
// auth.users, not profiles).
export async function fetchFriendships() {
  const user = await getCurrentUser();

  if (!user) {
    return { friends: [], incoming: [], outgoing: [] };
  }

  const { data: rows, error } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  if (error) {
    throw new Error(error.message || "Unable to load friends.");
  }

  const counterpartIds = (rows ?? []).map((row) =>
    row.requester_id === user.id ? row.addressee_id : row.requester_id,
  );

  let profilesById = {};
  if (counterpartIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, username, full_name, major, year")
      .in("id", counterpartIds);

    if (profilesError) {
      throw new Error(profilesError.message || "Unable to load friend profiles.");
    }

    profilesById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  }

  const buckets = { friends: [], incoming: [], outgoing: [] };

  for (const row of rows ?? []) {
    const counterpartId =
      row.requester_id === user.id ? row.addressee_id : row.requester_id;
    const entry = {
      friendshipId: row.id,
      // users can exist without a profiles row; keep them listable
      profile: profilesById[counterpartId] ?? {
        id: counterpartId,
        username: null,
        full_name: null,
        major: null,
        year: null,
      },
    };

    if (row.status === "accepted") buckets.friends.push(entry);
    else if (row.addressee_id === user.id) buckets.incoming.push(entry);
    else buckets.outgoing.push(entry);
  }

  return buckets;
}

// Suggested friends: overlap with your clubs/classes/major.
// ponytail: client-side scoring over the first 100 profiles — fine at campus
// scale; move the scoring into a Postgres RPC if the user base outgrows it.
export async function fetchSuggestedUsers() {
  const user = await getCurrentUser();

  if (!user) return [];

  const { data: me, error: meError } = await supabase
    .from("profiles")
    .select("clubs, classes, major")
    .eq("id", user.id)
    .maybeSingle();

  if (meError) {
    throw new Error(meError.message || "Unable to load your profile.");
  }

  const myClubs = new Set(me?.clubs ?? []);
  const myClasses = new Set(me?.classes ?? []);
  const myMajor = me?.major ?? null;

  if (myClubs.size === 0 && myClasses.size === 0 && !myMajor) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, major, year, clubs, classes")
    .neq("id", user.id)
    .limit(100);

  if (error) {
    throw new Error(error.message || "Unable to load suggestions.");
  }

  return (data ?? [])
    .map((profile) => {
      const sharedClubs = (profile.clubs ?? []).filter((c) => myClubs.has(c));
      const sharedClasses = (profile.classes ?? []).filter((c) =>
        myClasses.has(c),
      );
      const sameMajor = Boolean(myMajor && profile.major === myMajor);
      return {
        ...profile,
        sharedClubs,
        sharedClasses,
        sameMajor,
        score: 2 * (sharedClubs.length + sharedClasses.length) + (sameMajor ? 1 : 0),
      };
    })
    .filter((profile) => profile.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export async function sendFriendRequest(addresseeId) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("You must be signed in to send a friend request.");
  }

  const { error } = await supabase.from("friendships").insert({
    requester_id: user.id,
    addressee_id: addresseeId,
    status: "pending",
  });

  if (error) {
    // unique pair index fires for duplicates in either direction
    if (/duplicate|unique/i.test(error.message)) {
      throw new Error("A friend request already exists between you two.");
    }
    throw new Error(error.message || "Unable to send this friend request.");
  }
}

export async function acceptFriendRequest(friendshipId) {
  const { data, error } = await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("id", friendshipId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to accept this friend request.");
  }

  if (!data) {
    throw new Error("This request could not be accepted.");
  }
}

// Covers decline, cancel, and unfriend — RLS lets either party delete.
export async function removeFriendship(friendshipId) {
  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", friendshipId);

  if (error) {
    throw new Error(error.message || "Unable to remove this friendship.");
  }
}

export async function fetchFriendBusy(friendId) {
  const { data, error } = await supabase.rpc("get_friend_busy", {
    friend: friendId,
  });

  if (error) {
    throw new Error(error.message || "Unable to load this friend's availability.");
  }

  return data ?? [];
}
