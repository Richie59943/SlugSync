import React, { useEffect, useState } from "react";
import Auth from "./Auth";
import { supabase } from "../lib/supabaseClient";
import {
  acceptFriendRequest,
  fetchFriendBusy,
  fetchFriendships,
  fetchSuggestedUsers,
  removeFriendship,
  searchUsers,
  sendFriendRequest,
} from "../data/friendService";
import { toBusySet } from "../data/busyGrid";
import { initialsFromName } from "../lib/displayName";

const GRID_START_HOUR = 8;
const GRID_END_HOUR = 22;

const AVATAR_COLORS = ["#3b6fe0", "#7c56f0", "#23a35f", "#e0912b", "#e04e93", "#1aa89b"];

function displayName(profile) {
  return profile.full_name || profile.username || "Unnamed slug";
}

// Deterministic color per profile id so the same person always gets the
// same avatar color, without storing anything new.
function avatarColorFor(id) {
  if (!id) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash];
}

function FriendAvatar({ profile }) {
  return (
    <span className="friend-avatar" style={{ background: avatarColorFor(profile.id) }}>
      {initialsFromName(displayName(profile))}
    </span>
  );
}

// next 7 days as { key: "YYYY-MM-DD", label: "Mon 20" }, built manually to
// avoid the toISOString timezone shift
function nextSevenDays() {
  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
    days.push({
      key,
      label: d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" }),
    });
  }
  return days;
}

function formatHour(hour) {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}${hour >= 12 ? "pm" : "am"}`;
}

function BusyGrid({ rows }) {
  const days = nextSevenDays();
  const busy = toBusySet(rows);
  const hours = [];
  for (let h = GRID_START_HOUR; h < GRID_END_HOUR; h += 1) hours.push(h);

  const hasBusyInWindow = days.some((day) =>
    hours.some((hour) => busy.has(`${day.key}|${hour}`)),
  );

  if (!hasBusyInWindow) {
    return (
      <p className="empty-state">
        Totally free this week — no busy blocks in the next 7 days.
      </p>
    );
  }

  return (
    <div className="busy-grid" role="img" aria-label="Weekly availability grid">
      <span className="busy-day-label" />
      {days.map((day) => (
        <span className="busy-day-label" key={day.key}>
          {day.label}
        </span>
      ))}
      {hours.map((hour) => (
        <React.Fragment key={hour}>
          <span className="busy-hour-label">{formatHour(hour)}</span>
          {days.map((day) => (
            <span
              className={`busy-cell${busy.has(`${day.key}|${hour}`) ? " is-busy" : ""}`}
              key={`${day.key}|${hour}`}
              title={busy.has(`${day.key}|${hour}`) ? "Busy" : "Free"}
            />
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}

function Friends() {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [buckets, setBuckets] = useState({
    friends: [],
    incoming: [],
    outgoing: [],
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState(null); // friend profile being viewed
  const [busyRows, setBusyRows] = useState(null); // null = loading
  const [friendToRemove, setFriendToRemove] = useState(null);
  const [message, setMessage] = useState(null); // { type, text }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    refreshFriendships();
    // suggestions are best-effort — a failure just leaves the section empty
    fetchSuggestedUsers().then(setSuggestions).catch(() => {});
  }, [session?.user?.id]);

  // Instagram-style live search: debounce typing, then fetch matches
  useEffect(() => {
    const q = searchQuery.trim();

    if (!q) {
      setSearchResults([]);
      setSearched(false);
      setSearching(false);
      return;
    }

    let stale = false;
    setSearching(true);

    const timer = setTimeout(async () => {
      try {
        const results = await searchUsers(q);
        if (stale) return;
        setSearchResults(results);
        setSearched(true);
      } catch (error) {
        if (!stale) setMessage({ type: "error", text: error.message });
      } finally {
        if (!stale) setSearching(false);
      }
    }, 300);

    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  async function refreshFriendships() {
    try {
      setBuckets(await fetchFriendships());
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    }
  }

  // ponytail: mutations just re-fetch the buckets instead of juggling
  // optimistic state — friend lists are small
  async function runAction(action, successText) {
    setMessage(null);
    try {
      await action();
      await refreshFriendships();
      if (successText) setMessage({ type: "success", text: successText });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    }
  }

  function relationshipWith(profileId) {
    if (buckets.friends.some((f) => f.profile.id === profileId)) return "Friends";
    if (
      buckets.incoming.some((f) => f.profile.id === profileId) ||
      buckets.outgoing.some((f) => f.profile.id === profileId)
    ) {
      return "Pending";
    }
    return null;
  }

  function renderAddAction(profile) {
    const relationship = relationshipWith(profile.id);
    if (relationship) {
      return <span className="badge badge-private">{relationship}</span>;
    }
    return (
      <button
        className="btn-primary"
        onClick={() =>
          runAction(
            () => sendFriendRequest(profile.id),
            `Friend request sent to ${displayName(profile)}.`,
          )
        }
        type="button"
      >
        Add Friend
      </button>
    );
  }

  function suggestionReason(profile) {
    const parts = [];
    if (profile.sharedClubs.length > 0) {
      parts.push(
        profile.sharedClubs.length === 1
          ? profile.sharedClubs[0]
          : `${profile.sharedClubs.length} shared clubs`,
      );
    }
    if (profile.sharedClasses.length > 0) {
      parts.push(
        profile.sharedClasses.length === 1
          ? profile.sharedClasses[0]
          : `${profile.sharedClasses.length} shared classes`,
      );
    }
    if (profile.sameMajor) parts.push("same major");
    return parts.join(" · ");
  }

  // hide suggestions you're already connected to as requests go out
  const visibleSuggestions = suggestions.filter(
    (profile) => !relationshipWith(profile.id),
  );

  async function handleViewAvailability(profile) {
    setSelected(profile);
    setBusyRows(null);
    setMessage(null);
    try {
      setBusyRows(await fetchFriendBusy(profile.id));
    } catch (error) {
      setSelected(null);
      setMessage({ type: "error", text: error.message });
    }
  }

  if (session === undefined) {
    return (
      <main className="dashboard">
        <p className="empty-state">Loading…</p>
      </main>
    );
  }

  if (!session) {
    return <Auth />;
  }

  const hasRequests = buckets.incoming.length > 0 || buckets.outgoing.length > 0;

  return (
    <main className="dashboard">
      <section className="welcome-section">
        <div>
          <p className="eyebrow">Coordinate hangouts</p>
          <h1>Friends</h1>
          <p>
            Find other slugs, add them as friends, and see when they're free —
            without seeing their private event details.
          </p>
        </div>
      </section>

      <section className="panel" aria-label="Find friends">
        <div className="friend-search">
          <input
            aria-label="Search for friends"
            className="friend-search-input"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍  Search slugs by name or username"
            type="search"
            value={searchQuery}
          />
          {searchQuery.trim() && (
            <div className="search-dropdown">
              {searching && <p className="empty-state">Searching…</p>}
              {!searching && searched && searchResults.length === 0 && (
                <p className="empty-state">
                  No slugs found for "{searchQuery.trim()}".
                </p>
              )}
              {searchResults.map((profile) => (
                <article className="friend-row" key={profile.id}>
                  <div className="friend-row-main">
                    <FriendAvatar profile={profile} />
                    <div>
                      <strong>{displayName(profile)}</strong>
                      <p>
                        {[
                          profile.username && `@${profile.username}`,
                          profile.major,
                          profile.year,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>
                  {renderAddAction(profile)}
                </article>
              ))}
            </div>
          )}
        </div>

        {message && (
          <p className={`event-message event-message-${message.type}`}>
            {message.text}
          </p>
        )}

        {visibleSuggestions.length > 0 && (
          <div className="suggested-friends">
            <h2>Suggested for you</h2>
            {visibleSuggestions.map((profile) => (
              <article className="friend-row" key={profile.id}>
                <div className="friend-row-main">
                  <FriendAvatar profile={profile} />
                  <div>
                    <strong>{displayName(profile)}</strong>
                    <p>{suggestionReason(profile)}</p>
                  </div>
                </div>
                {renderAddAction(profile)}
              </article>
            ))}
          </div>
        )}
      </section>

      {hasRequests && (
        <section className="panel" aria-label="Friend requests">
          <h2>Requests</h2>
          {buckets.incoming.map(({ friendshipId, profile }) => (
            <article className="friend-row" key={friendshipId}>
              <div className="friend-row-main">
                <FriendAvatar profile={profile} />
                <div>
                  <strong>{displayName(profile)}</strong>
                  <p>wants to be your friend</p>
                </div>
              </div>
              <div className="friend-row-actions">
                <button
                  className="btn-primary"
                  onClick={() =>
                    runAction(
                      () => acceptFriendRequest(friendshipId),
                      `You and ${displayName(profile)} are now friends.`,
                    )
                  }
                  type="button"
                >
                  Accept
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => runAction(() => removeFriendship(friendshipId))}
                  type="button"
                >
                  Decline
                </button>
              </div>
            </article>
          ))}
          {buckets.outgoing.map(({ friendshipId, profile }) => (
            <article className="friend-row" key={friendshipId}>
              <div className="friend-row-main">
                <FriendAvatar profile={profile} />
                <div>
                  <strong>{displayName(profile)}</strong>
                  <p>request pending</p>
                </div>
              </div>
              <button
                className="btn-secondary"
                onClick={() => runAction(() => removeFriendship(friendshipId))}
                type="button"
              >
                Cancel
              </button>
            </article>
          ))}
        </section>
      )}

      <section className="panel" aria-label="Your friends">
        <h2>Your friends</h2>
        {buckets.friends.length === 0 && (
          <p className="empty-state">
            No friends yet — search above to add some.
          </p>
        )}
        {buckets.friends.map(({ friendshipId, profile }) => (
          <article className="friend-row" key={friendshipId}>
            <div className="friend-row-main">
              <FriendAvatar profile={profile} />
              <div>
                <strong>{displayName(profile)}</strong>
                <p>
                  {[profile.username && `@${profile.username}`, profile.major]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>
            <div className="friend-row-actions">
              <button
                className="btn-secondary"
                onClick={() => handleViewAvailability(profile)}
                type="button"
              >
                View availability
              </button>
              <button
                className="btn-danger"
                onClick={() => setFriendToRemove({ friendshipId, profile })}
                type="button"
              >
                Remove
              </button>
            </div>
          </article>
        ))}
      </section>

      {selected && (
        <section className="panel" aria-label="Friend availability">
          <div className="friend-row">
            <div className="friend-row-main">
              <FriendAvatar profile={selected} />
              <h2 style={{ margin: 0 }}>{displayName(selected)}'s week</h2>
            </div>
            <button
              className="btn-secondary"
              onClick={() => {
                setSelected(null);
                setBusyRows(null);
              }}
              type="button"
            >
              Close
            </button>
          </div>
          {busyRows === null ? (
            <p className="empty-state">Loading availability…</p>
          ) : (
            <BusyGrid rows={busyRows} />
          )}
        </section>
      )}

      {friendToRemove && (
        <div
          aria-labelledby="remove-friend-title"
          aria-modal="true"
          className="modal-backdrop"
          role="dialog"
        >
          <div className="confirm-dialog">
            <p className="eyebrow">Remove friend</p>
            <h2 id="remove-friend-title">
              {displayName(friendToRemove.profile)}
            </h2>
            <p>
              You'll both stop seeing each other's availability. You can add
              them again later.
            </p>
            <div className="confirm-actions">
              <button
                className="btn-secondary"
                onClick={() => setFriendToRemove(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={() => {
                  const { friendshipId, profile } = friendToRemove;
                  setFriendToRemove(null);
                  if (selected?.id === profile.id) {
                    setSelected(null);
                    setBusyRows(null);
                  }
                  runAction(
                    () => removeFriendship(friendshipId),
                    `Removed ${displayName(profile)}.`,
                  );
                }}
                type="button"
              >
                Confirm remove
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default Friends;
