// Maps the loose, mostly-optional `category` text on real events (plus
// visibility/source as a fallback) to the reference design's category
// palette. Real events rarely set `category` yet, so this degrades to a
// neutral badge instead of inventing a classification that isn't there.

export const CATEGORY_PALETTE = {
  campus: { label: "Campus", bg: "#eaf1ff", text: "#2f5ecb", dot: "#3b6fe0" },
  community: { label: "Community", bg: "#f0ecff", text: "#6b46e0", dot: "#7c56f0" },
  clubs: { label: "Clubs", bg: "#e8f6ee", text: "#1f8a52", dot: "#23a35f" },
  classes: { label: "Classes", bg: "#fdf1e0", text: "#b5731a", dot: "#e0912b" },
  music: { label: "Music & Arts", bg: "#fdeaf3", text: "#c23a7e", dot: "#e04e93" },
  outdoors: { label: "Outdoors", bg: "#e5f5f4", text: "#16897f", dot: "#1aa89b" },
};

const NEUTRAL = { label: null, bg: "#f2f3f6", text: "#5b6472", dot: "#8a92a3" };

const KEYWORD_BUCKETS = [
  [/campus|lecture|orgs?\b|opers/i, "campus"],
  [/communit/i, "community"],
  [/club/i, "clubs"],
  [/academic|class/i, "classes"],
  [/music|art/i, "music"],
  [/sport|outdoor|recreation/i, "outdoors"],
];

function bucketFor(event) {
  const category = event?.category;
  if (category) {
    for (const [pattern, key] of KEYWORD_BUCKETS) {
      if (pattern.test(category)) return key;
    }
  }
  if (event?.source === "UCSC Events") return "campus";
  if (event?.visibility === "community") return "community";
  return null;
}

// Returns { key, label, bg, text, dot } — label prefers the event's own
// category text so real data isn't relabeled, falling back to the bucket's
// display name, the source, or a generic "Event".
export function getCategoryStyle(event) {
  const key = bucketFor(event);
  const palette = key ? CATEGORY_PALETTE[key] : NEUTRAL;
  const label = event?.category || palette.label || event?.source || "Event";
  return { key, label, bg: palette.bg, text: palette.text, dot: palette.dot };
}
