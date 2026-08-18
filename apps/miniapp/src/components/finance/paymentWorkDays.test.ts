import { describe, expect, it } from "vitest";
import {
  countActiveDaysInRange,
  daysWorkedLastWeek,
  previousIsoWeekRange,
} from "./paymentWorkDays";

describe("previousIsoWeekRange", () => {
  it("returns Mon–Sun of the previous ISO week", () => {
    // 2026-08-18 is a Tuesday → this week Mon=2026-08-17 → prev = 08-10..08-16
    expect(previousIsoWeekRange("2026-08-18")).toEqual({
      from: "2026-08-10",
      to: "2026-08-16",
    });
  });

  it("works when asOf is Monday", () => {
    // 2026-08-17 Monday → prev week 08-10..08-16
    expect(previousIsoWeekRange("2026-08-17")).toEqual({
      from: "2026-08-10",
      to: "2026-08-16",
    });
  });
});

describe("countActiveDaysInRange", () => {
  it("counts full overlap", () => {
    expect(
      countActiveDaysInRange(
        [{ startDate: "2026-08-01", endDate: null }],
        "2026-08-10",
        "2026-08-16",
      ),
    ).toBe(7);
  });

  it("counts partial overlap", () => {
    expect(
      countActiveDaysInRange(
        [{ startDate: "2026-08-14", endDate: null }],
        "2026-08-10",
        "2026-08-16",
      ),
    ).toBe(3); // 14,15,16
  });

  it("respects agreement end date", () => {
    expect(
      countActiveDaysInRange(
        [{ startDate: "2026-08-01", endDate: "2026-08-12" }],
        "2026-08-10",
        "2026-08-16",
      ),
    ).toBe(3); // 10,11,12
  });
});

describe("daysWorkedLastWeek", () => {
  it("returns days + range for payment date", () => {
    const result = daysWorkedLastWeek(
      [{ startDate: "2026-08-01", endDate: null }],
      "2026-08-18",
    );
    expect(result).toEqual({ days: 7, from: "2026-08-10", to: "2026-08-16" });
  });
});
