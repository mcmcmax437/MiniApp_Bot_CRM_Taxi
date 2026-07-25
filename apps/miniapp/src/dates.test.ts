import { describe, expect, it } from "vitest";
import { formatDate, isoDateOnly } from "./dates.js";

describe("formatDate", () => {
  it("formats ISO date-only as DD/MM/YY", () => {
    expect(formatDate("2026-03-16")).toBe("16/03/26");
  });

  it("formats UTC noon ISO timestamps by calendar date prefix", () => {
    expect(formatDate("2026-05-23T12:00:00.000Z")).toBe("23/05/26");
  });

  it("returns em dash for empty values", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
  });
});

describe("isoDateOnly", () => {
  it("keeps YYYY-MM-DD", () => {
    expect(isoDateOnly("2026-03-16")).toBe("2026-03-16");
  });

  it("extracts date from full ISO", () => {
    expect(isoDateOnly("2026-03-16T12:00:00.000Z")).toBe("2026-03-16");
  });

  it("returns empty string for missing values", () => {
    expect(isoDateOnly(null)).toBe("");
  });
});
