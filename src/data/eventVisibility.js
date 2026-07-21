export const EVENT_VISIBILITY = {
  PRIVATE: "private",
  COMMUNITY: "community",
  FRIENDS: "friends",
};

export const EVENT_VISIBILITY_OPTIONS = [
  {
    value: EVENT_VISIBILITY.PRIVATE,
    label: "Private",
    description: "Only visible on your dashboard and calendar",
  },
  {
    value: EVENT_VISIBILITY.FRIENDS,
    label: "Visible to friends",
    description: "Only visible to you and your friends",
  },
];

export function normalizeEventVisibility(value) {
  return value === EVENT_VISIBILITY.COMMUNITY || value === "public"
    ? EVENT_VISIBILITY.COMMUNITY
    : EVENT_VISIBILITY.PRIVATE;
}
