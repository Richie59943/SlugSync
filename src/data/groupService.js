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

function decorateGroup(group, memberships, currentUserId) {
  const currentUserMembership =
    memberships.find((membership) => membership.user_id === currentUserId) ?? null;
  const currentUserRole = currentUserMembership?.role ?? null;

  return {
    ...group,
    members: memberships,
    currentUserMembership,
    currentUserRole,
    canEdit: currentUserRole === "owner" || currentUserRole === "admin",
    canLeave: currentUserRole === "admin" || currentUserRole === "member",
    isOwner: currentUserRole === "owner",
  };
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
      ...decorateGroup(group, membershipsByGroup[group.id] ?? [], user.id),
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
    ...decorateGroup(group, members, user.id),
    memberSummary:
      members.length > 0
        ? members.map((member) => profileDisplayName(member.profile)).join(", ")
        : "Just you for now",
  };
}

export async function updateGroup(groupId, { name, description }) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("You must be signed in to edit a group.");
  }

  if (!groupId) {
    throw new Error("Missing group id. The group could not be updated.");
  }

  const trimmedName = name?.trim();
  if (!trimmedName) {
    throw new Error("Group name is required.");
  }

  const { data: group, error } = await supabase
    .from("groups")
    .update({
      name: trimmedName,
      description: description?.trim() || null,
    })
    .eq("id", groupId)
    .select("id, name, description, created_by, created_at, updated_at")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to update this group.");
  }

  if (!group) {
    throw new Error("This group was not updated because you do not have permission.");
  }

  const membershipsByGroup = await fetchGroupMemberships([group.id]);
  return decorateGroup(group, membershipsByGroup[group.id] ?? [], user.id);
}

export async function leaveGroup(groupId) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("You must be signed in to leave a group.");
  }

  if (!groupId) {
    throw new Error("Missing group id. The group could not be left.");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("group_members")
    .select("id, role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message || "Unable to verify your group membership.");
  }

  if (!membership) {
    throw new Error("You are not a member of this group.");
  }

  if (membership.role === "owner") {
    throw new Error("You must transfer ownership or delete the group before leaving.");
  }

  const { data, error } = await supabase
    .from("group_members")
    .delete()
    .eq("id", membership.id)
    .eq("user_id", user.id)
    .neq("role", "owner")
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to leave this group.");
  }

  if (!data) {
    throw new Error("The group was not left because your membership could not be removed.");
  }

  return data;
}

export async function transferGroupOwnership(groupId, newOwnerId) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("You must be signed in to transfer ownership.");
  }

  if (!groupId || !newOwnerId) {
    throw new Error("Choose a group member to become the new owner.");
  }

  const { error } = await supabase.rpc("transfer_group_ownership", {
    target_group_id: groupId,
    new_owner_id: newOwnerId,
  });

  if (error) {
    throw new Error(error.message || "Unable to transfer group ownership.");
  }
}

export async function deleteGroup(groupId) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("You must be signed in to delete a group.");
  }

  if (!groupId) {
    throw new Error("Missing group id. The group could not be deleted.");
  }

  const { data, error } = await supabase
    .from("groups")
    .delete()
    .eq("id", groupId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to delete this group.");
  }

  if (!data) {
    throw new Error("This group was not deleted because you do not have permission.");
  }

  return data;
}
