import { supabase } from "../lib/supabaseClient";
import { getCurrentUser } from "./eventService";

function uniqueMemberIds(memberIds, currentUserId) {
  return [...new Set(memberIds ?? [])].filter((id) => id && id !== currentUserId);
}

function profileDisplayName(profile) {
  return profile?.full_name || profile?.username || "Unnamed slug";
}

function attachProfilesToMemberships(memberships, profilesById) {
  return memberships.map((membership) => ({
    ...membership,
    profile: profilesById[membership.user_id] ?? {
      id: membership.user_id,
      username: null,
      full_name: null,
      major: null,
      year: null,
    },
  }));
}

async function fetchProfilesById(userIds) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return {};

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, major, year")
    .in("id", uniqueIds);

  if (error) {
    throw new Error(error.message || "Unable to load group member profiles.");
  }

  return Object.fromEntries((data ?? []).map((profile) => [profile.id, profile]));
}

async function fetchGroupMemberships(groupIds) {
  if (groupIds.length === 0) return {};

  const { data, error } = await supabase
    .from("group_members")
    .select("group_id, user_id, role, joined_at")
    .in("group_id", groupIds)
    .order("joined_at", { ascending: true });

  if (error) {
    throw new Error(error.message || "Unable to load group memberships.");
  }

  const profilesById = await fetchProfilesById((data ?? []).map((row) => row.user_id));
  const membershipsByGroup = {};

  for (const membership of attachProfilesToMemberships(data ?? [], profilesById)) {
    if (!membershipsByGroup[membership.group_id]) {
      membershipsByGroup[membership.group_id] = [];
    }
    membershipsByGroup[membership.group_id].push(membership);
  }

  return membershipsByGroup;
}

export async function fetchGroups() {
  const user = await getCurrentUser();

  if (!user) {
    return { groups: [], user: null };
  }

  const { data, error } = await supabase
    .from("groups")
    .select("id, name, description, created_by, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Unable to load groups.");
  }

  const membershipsByGroup = await fetchGroupMemberships(
    (data ?? []).map((group) => group.id),
  );

  return {
    groups: (data ?? []).map((group) => ({
      ...group,
      members: membershipsByGroup[group.id] ?? [],
    })),
    user,
  };
}

export async function createGroupWithMembers({ name, description, memberIds }) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("You must be signed in to create a group.");
  }

  const trimmedName = name?.trim();
  if (!trimmedName) {
    throw new Error("Group name is required.");
  }

  const selectedMemberIds = uniqueMemberIds(memberIds, user.id);
  const payload = {
    name: trimmedName,
    description: description?.trim() || null,
    created_by: user.id,
  };

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .insert(payload)
    .select("id, name, description, created_by, created_at, updated_at")
    .single();

  if (groupError) {
    throw new Error(groupError.message || "Unable to create this group.");
  }

  try {
    if (selectedMemberIds.length > 0) {
      const rows = selectedMemberIds.map((memberId) => ({
        group_id: group.id,
        user_id: memberId,
        role: "member",
      }));

      const { error: membersError } = await supabase
        .from("group_members")
        .insert(rows);

      if (membersError) {
        throw new Error(membersError.message || "Unable to add group members.");
      }
    }
  } catch (membersError) {
    await supabase.from("groups").delete().eq("id", group.id);
    throw membersError;
  }

  const membershipsByGroup = await fetchGroupMemberships([group.id]);
  const members = membershipsByGroup[group.id] ?? [];

  return {
    ...group,
    members,
    memberSummary:
      members.length > 0
        ? members.map((member) => profileDisplayName(member.profile)).join(", ")
        : "Just you for now",
  };
}
