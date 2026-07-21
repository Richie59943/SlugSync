import { describe, expect, it } from "vitest";
import {
  DIGEST_RANGES,
  digestHeading,
  digestPeriodLabel,
  filterEventsInRange,
  groupEventsByWeekday,
  isEventInRange,
} from "./digestRange";

const NOW = new Date("2026-07-15T09:00:00");

describe("digestHeading / digestPeriodLabel", () => {
  it("labels each range and falls back to daily for an unknown value", () => {
    expect(digestHeading(DIGEST_RANGES.WEEKLY)).toBe("Weekly digest");
    expect(digestPeriodLabel(DIGEST_RANGES.MONTHLY)).toBe("this month");
    expect(digestHeading("bogus")).toBe("Daily digest");
  });
});

describe("isEventInRange", () => {
  it("never throws on an event with no date", () => {
    expect(isEventInRange({}, DIGEST_RANGES.DAILY, NOW)).toBe(false);
    expect(isEventInRange(null, DIGEST_RANGES.DAILY, NOW)).toBe(false);
  });

  it("daily only matches today", () => {
    expect(isEventInRange({ eventDate: "2026-07-15" }, DIGEST_RANGES.DAILY, NOW)).toBe(true);
    expect(isEventInRange({ eventDate: "2026-07-16" }, DIGEST_RANGES.DAILY, NOW)).toBe(false);
  });

  it("weekly matches the next 7 days but not day 8", () => {
    expect(isEventInRange({ eventDate: "2026-07-21" }, DIGEST_RANGES.WEEKLY, NOW)).toBe(true);
    expect(isEventInRange({ eventDate: "2026-07-22" }, DIGEST_RANGES.WEEKLY, NOW)).toBe(false);
  });

  it("monthly matches the rest of the calendar month but not next month", () => {
    expect(isEventInRange({ eventDate: "2026-07-31" }, DIGEST_RANGES.MONTHLY, NOW)).toBe(true);
    expect(isEventInRange({ eventDate: "2026-08-01" }, DIGEST_RANGES.MONTHLY, NOW)).toBe(false);
  });

  it("excludes events already in the past", () => {
    expect(isEventInRange({ eventDate: "2026-07-14" }, DIGEST_RANGES.MONTHLY, NOW)).toBe(false);
  });
});

describe("filterEventsInRange", () => {
  it("filters a mixed list down to the requested range", () => {
    const events = [
      { id: 1, eventDate: "2026-07-15" },
      { id: 2, eventDate: "2026-07-20" },
      { id: 3, eventDate: "2026-08-02" },
    ];
    expect(filterEventsInRange(events, DIGEST_RANGES.WEEKLY, NOW).map((e) => e.id)).toEqual([1, 2]);
  });
});

describe("groupEventsByWeekday", () => {
  it("always returns 7 days starting from today, regardless of weekday", () => {
    const days = groupEventsByWeekday([], NOW);
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ dateKey: "2026-07-15", label: "Wednesday", shortDate: "Jul 15" });
    expect(days[6]).toMatchObject({ dateKey: "2026-07-21", label: "Tuesday", shortDate: "Jul 21" });
  });

  it("buckets events onto their matching day and leaves other days empty", () => {
    const events = [
      { id: 1, eventDate: "2026-07-15" },
      { id: 2, eventDate: "2026-07-15" },
      { id: 3, eventDate: "2026-07-18" },
    ];
    const days = groupEventsByWeekday(events, NOW);
    expect(days[0].events.map((e) => e.id)).toEqual([1, 2]);
    expect(days[3].events.map((e) => e.id)).toEqual([3]);
    expect(days[1].events).toEqual([]);
  });

  it("drops events outside the 7-day window", () => {
    const events = [{ id: 1, eventDate: "2026-07-22" }];
    const days = groupEventsByWeekday(events, NOW);
    expect(days.every((day) => day.events.length === 0)).toBe(true);
  });
});
