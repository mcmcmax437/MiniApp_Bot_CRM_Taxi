import { describe, expect, it, vi } from "vitest";
import { commitFinanceCustomRange, financeInPeriod } from "./financePeriod";

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

  it("matches the previous calendar month, including January", () => {
    const october = new Date(2026, 9, 4);
    expect(financeInPeriod("2026-09-01", "previous", null, october)).toBe(true);
    expect(financeInPeriod("2026-09-30", "previous", null, october)).toBe(true);
    expect(financeInPeriod("2026-10-01", "previous", null, october)).toBe(false);
    expect(financeInPeriod("2025-12-31", "previous", null, new Date(2026, 0, 10))).toBe(true);
  });
});

describe("commitFinanceCustomRange", () => {
  it("commits a normalized custom range and selects the custom period", () => {
    const onDateRangeChange = vi.fn();
    const onPeriodChange = vi.fn();

    expect(
      commitFinanceCustomRange(
        "2026-07-31",
        "2026-07-01",
        onDateRangeChange,
        onPeriodChange,
      ),
    ).toBe(true);

    expect(onDateRangeChange).toHaveBeenCalledWith({ from: "2026-07-01", to: "2026-07-31" });
    expect(onPeriodChange).toHaveBeenCalledWith("custom");
  });

  it("does not partially commit incomplete custom ranges", () => {
    const onDateRangeChange = vi.fn();
    const onPeriodChange = vi.fn();

    expect(commitFinanceCustomRange("2026-07-01", "", onDateRangeChange, onPeriodChange)).toBe(false);
    expect(commitFinanceCustomRange("", "2026-07-31", onDateRangeChange, onPeriodChange)).toBe(false);

    expect(onDateRangeChange).not.toHaveBeenCalled();
    expect(onPeriodChange).not.toHaveBeenCalled();
  });
});
