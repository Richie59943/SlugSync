import { describe, expect, it } from "vitest";
import { matchesPreferences } from "./matchesPreferences";

describe("matchesPreferences", () => {
  it("shows everything when there is no event or no preferences", () => {
    expect(matchesPreferences(null, { clubs: ["Chess"] })).toBe(true);
    expect(matchesPreferences({ club: "Chess" }, null)).toBe(true);
  });

  it("shows everything when no preferences are selected at all", () => {
    const event = { category: "Music", club: "Chess", class_code: "CSE101" };
    expect(matchesPreferences(event, { clubs: [], classes: [], categories: [] })).toBe(true);
  });

  it("matches on a literal category string", () => {
    const event = { category: "Music" };
    expect(matchesPreferences(event, { categories: ["music"] })).toBe(true);
  });

  it("matches on the bucketed category label when the raw category doesn't match", () => {
    // No raw `category` set, but source implies the "campus" bucket, whose
    // label is "Campus" — this is the fallback path in matchesPreferences.
    const event = { source: "UCSC Events" };
    expect(matchesPreferences(event, { categories: ["campus"] })).toBe(true);
  });

  it("matches on club, case-insensitively and trimming whitespace", () => {
    const event = { club: "Chess Club" };
    expect(matchesPreferences(event, { clubs: ["  chess club  "] })).toBe(true);
  });

  it("matches on class_code, falling back to class", () => {
    expect(
      matchesPreferences({ class_code: "CSE101" }, { classes: ["cse101"] })
    ).toBe(true);
    expect(
      matchesPreferences({ class: "CSE101" }, { classes: ["cse101"] })
    ).toBe(true);
  });

  it("returns false when nothing matches", () => {
    const event = { category: "Music", club: "Chess", class_code: "CSE101" };
    const preferences = { categories: ["outdoors"], clubs: ["Robotics"], classes: ["MATH19A"] };
    expect(matchesPreferences(event, preferences)).toBe(false);
  });

  it("never throws on missing/null event fields", () => {
    expect(() => matchesPreferences({}, { clubs: ["chess"] })).not.toThrow();
  });
});
