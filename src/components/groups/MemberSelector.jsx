import React, { useMemo, useState } from "react";
import { initialsFromName } from "../../lib/displayName";

function displayName(profile) {
  return profile.full_name || profile.username || "Unnamed slug";
}

function profileMeta(profile) {
  return [profile.username && `@${profile.username}`, profile.major, profile.year]
    .filter(Boolean)
    .join(" · ");
}

function matchesQuery(profile, query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [profile.full_name, profile.username, profile.major, profile.year]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(normalized));
}

function MemberSelector({ friends = [], selectedIds = [], onChange }) {
  const [query, setQuery] = useState("");
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedProfiles = friends.filter((profile) => selectedIdSet.has(profile.id));
  const availableFriends = friends.filter(
    (profile) => !selectedIdSet.has(profile.id) && matchesQuery(profile, query),
  );

  function addMember(profileId) {
    if (selectedIdSet.has(profileId)) return;
    onChange([...selectedIds, profileId]);
  }

  function removeMember(profileId) {
    onChange(selectedIds.filter((id) => id !== profileId));
  }

  return (
    <div className="member-selector">
      <label className="group-form-label">
        Add friends
        <input
          className="group-form-input"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search your accepted friends"
          type="search"
          value={query}
        />
      </label>

      {selectedProfiles.length > 0 && (
        <div className="selected-members" aria-label="Selected group members">
          {selectedProfiles.map((profile) => (
            <button
              className="selected-member-chip"
              key={profile.id}
              onClick={() => removeMember(profile.id)}
              type="button"
            >
              <span>{displayName(profile)}</span>
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}

      <div className="member-selector-list">
        {friends.length === 0 && (
          <p className="empty-state">
            Add accepted friends first, then you can invite them into groups.
          </p>
        )}
        {friends.length > 0 && availableFriends.length === 0 && (
          <p className="empty-state">No available friends match your search.</p>
        )}
        {availableFriends.map((profile) => (
          <article className="friend-row member-option" key={profile.id}>
            <div className="friend-row-main">
              <span className="friend-avatar">
                {initialsFromName(displayName(profile))}
              </span>
              <div>
                <strong>{displayName(profile)}</strong>
                <p>{profileMeta(profile)}</p>
              </div>
            </div>
            <button
              className="btn-secondary"
              onClick={() => addMember(profile.id)}
              type="button"
            >
              Add
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

export default MemberSelector;
