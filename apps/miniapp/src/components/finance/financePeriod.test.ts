import { describe, expect, it } from "vitest";
import { financeInPeriod } from "./financePeriod";

describe("financeInPeriod", () => {
  it("matches all when period is all", () => {
    expect(financeInPeriod("2026-01-15", "all")).toBe(true);
  });

  it("matches custom inclusive range", () => {
    const range = { from: "2026-07-01", to: "2026-07-31" };
    expect(financeInPeriod("2026-07-01", "custom", range)).toBe(true);
    expect(financeInPeriod("2026-07-15", "custom", range)).toBe(true);
    expect(financeInPeriod("2026-07-31", "custom", range)).toBe(true);
    expect(financeInPeriod("2026-06-30", "custom", range)).toBe(false);
    expect(financeInPeriod("2026-08-01", "custom", range)).toBe(false);
  });

  it("swaps inverted custom range", () => {
    const range = { from: "2026-07-31", to: "2026-07-01" };
    expect(financeInPeriod("2026-07-15", "custom", range)).toBe(true);
  });

  it("matches nothing for custom without both dates", () => {
    expect(financeInPeriod("2026-07-15", "custom", null)).toBe(false);
    expect(financeInPeriod("2026-07-15", "custom", { from: "2026-07-01", to: "" })).toBe(false);
  });
});
