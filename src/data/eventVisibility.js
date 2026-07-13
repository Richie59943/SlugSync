export const EVENT_VISIBILITY = {
  PRIVATE: "private",
  COMMUNITY: "community",
};

export const EVENT_VISIBILITY_OPTIONS = [
  {
    value: EVENT_VISIBILITY.PRIVATE,
    label: "Private",
    description: "Only visible on your dashboard and calendar",
  },
  {
    value: EVENT_VISIBILITY.COMMUNITY,
    label: "Community",
    description: "Visible on your dashboard, calendar, and the community dashboard",
  },
];

export function normalizeEventVisibility(value) {
  return value === EVENT_VISIBILITY.COMMUNITY || value === "public"
    ? EVENT_VISIBILITY.COMMUNITY
    : EVENT_VISIBILITY.PRIVATE;
}
