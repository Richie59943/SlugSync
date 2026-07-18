import { describe, expect, it } from "vitest";
import { firstNameFromEmail, initialsFromEmail, initialsFromName } from "./displayName";

describe("initialsFromEmail", () => {
  it("uses the first two letters of the local part", () => {
    expect(initialsFromEmail("rirajeev@ucsc.edu")).toBe("RI");
  });

  it("strips non-letter characters before taking initials", () => {
    expect(initialsFromEmail("r.i.rajeev123@ucsc.edu")).toBe("RI");
  });

  it("falls back to the first character when letters are too short", () => {
    expect(initialsFromEmail("1@ucsc.edu")).toBe("1");
  });

  it("returns '?' for empty/null input", () => {
    expect(initialsFromEmail("")).toBe("?");
    expect(initialsFromEmail(null)).toBe("?");
    expect(initialsFromEmail(undefined)).toBe("?");
  });
});

describe("firstNameFromEmail", () => {
  it("capitalizes the first segment of the local part", () => {
    expect(firstNameFromEmail("ridhin.rajeev@ucsc.edu")).toBe("Ridhin");
  });

  it("splits on dots, underscores, and hyphens", () => {
    expect(firstNameFromEmail("jane_doe@ucsc.edu")).toBe("Jane");
    expect(firstNameFromEmail("jane-doe@ucsc.edu")).toBe("Jane");
  });

  it("falls back to 'there' for empty/null/unusable input", () => {
    expect(firstNameFromEmail("")).toBe("there");
    expect(firstNameFromEmail(null)).toBe("there");
    expect(firstNameFromEmail("123@ucsc.edu")).toBe("there");
  });
});

describe("initialsFromName", () => {
  it("returns first+last initials for multi-word names", () => {
    expect(initialsFromName("Ridhin Rajeev")).toBe("RR");
  });

  it("returns first two letters for a single-word name", () => {
    expect(initialsFromName("Ridhin")).toBe("RI");
  });

  it("returns '?' for empty/null/whitespace-only input", () => {
    expect(initialsFromName("")).toBe("?");
    expect(initialsFromName(null)).toBe("?");
    expect(initialsFromName("   ")).toBe("?");
  });
});
