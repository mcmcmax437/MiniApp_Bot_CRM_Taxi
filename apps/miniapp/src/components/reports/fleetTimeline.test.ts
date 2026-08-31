import { describe, expect, it } from "vitest";
import { AgreementStatus, RentPeriod } from "@taxi/shared";
import type { Agreement } from "../../types";
import {
  barColor,
  buildFleetTimeline,
  canShiftTimelineForward,
  clipAgreementToRange,
  clipRangeToAsOf,
  defaultTimelineRange,
  expectedRentForDays,
  isoWeekRangeContaining,
  monthRangeContaining,
  rangeForScale,
  shiftTimelineRange,
  yearRangeContaining,
} from "./fleetTimeline";

function agreement(partial: Partial<Agreement> & Pick<Agreement, "id" | "carId">): Agreement {
  return {
    driverId: null,
    temporaryDriverName: "Temp",
    rentAmount: 700,
    depositAmount: 0,
    period: RentPeriod.WEEKLY,
    startDate: "2026-08-10",
    endDate: null,
    status: AgreementStatus.ACTIVE,
    notes: null,
    car: { id: partial.carId, plate: partial.car?.plate ?? "DX1" },
    ...partial,
  };
}

describe("range helpers", () => {
  it("builds Mon–Sun for an ISO week", () => {
    expect(isoWeekRangeContaining("2026-08-18")).toEqual({
      from: "2026-08-17",
      to: "2026-08-23",
    });
  });

  it("defaults week view to the previous ISO week", () => {
    // Tuesday 18 Aug 2026 → previous week 10–16
    expect(defaultTimelineRange("week", "2026-08-18")).toEqual({
      from: "2026-08-10",
      to: "2026-08-16",
    });
  });

  it("shifts month forward", () => {
    expect(shiftTimelineRange("month", monthRangeContaining("2026-08-05"), 1)).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("builds a full calendar year", () => {
    expect(yearRangeContaining("2026-08-18")).toEqual({
      from: "2026-01-01",
      to: "2026-12-31",
    });
  });

  it("uses current month/year as the default for those scales", () => {
    expect(rangeForScale("month", "2026-08-18")).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    expect(defaultTimelineRange("year", "2026-08-18")).toEqual({
      from: "2026-01-01",
      to: "2026-12-31",
    });
  });

  it("does not allow shifting into a period that starts after as-of", () => {
    expect(
      canShiftTimelineForward("week", { from: "2026-08-31", to: "2026-09-06" }, "2026-08-31"),
    ).toBe(false);
    expect(
      canShiftTimelineForward("week", { from: "2026-08-24", to: "2026-08-30" }, "2026-08-31"),
    ).toBe(true);
    expect(
      canShiftTimelineForward("month", { from: "2026-08-01", to: "2026-08-31" }, "2026-08-31"),
    ).toBe(false);
  });
});

describe("clipAgreementToRange", () => {
  const week = { from: "2026-08-10", to: "2026-08-16" };

  it("clips an open-ended rental to the range end", () => {
    expect(clipAgreementToRange("2026-08-01", null, week)).toEqual({
      from: "2026-08-10",
      to: "2026-08-16",
      days: 7,
    });
  });

  it("returns null when there is no overlap", () => {
    expect(clipAgreementToRange("2026-07-01", "2026-07-31", week)).toBeNull();
  });
});

describe("clipRangeToAsOf", () => {
  it("caps the range end at as-of and rejects a range that starts later", () => {
    expect(clipRangeToAsOf({ from: "2026-08-31", to: "2026-09-06" }, "2026-08-31")).toEqual({
      from: "2026-08-31",
      to: "2026-08-31",
    });
    expect(clipRangeToAsOf({ from: "2026-09-07", to: "2026-09-13" }, "2026-08-31")).toBeNull();
  });
});

describe("expectedRentForDays", () => {
  it("pro-rates weekly rent over the overlapping days", () => {
    expect(expectedRentForDays(700, RentPeriod.WEEKLY, 7)).toBe(700);
    expect(expectedRentForDays(700, RentPeriod.WEEKLY, 1)).toBe(100);
  });

  it("multiplies daily rent by days", () => {
    expect(expectedRentForDays(100, RentPeriod.DAILY, 3)).toBe(300);
  });
});

describe("buildFleetTimeline", () => {
  it("groups bars by car and sums expected rent", () => {
    const model = buildFleetTimeline(
      [
        agreement({
          id: "a1",
          carId: "c1",
          car: { id: "c1", plate: "DX90680" },
          driver: { id: "d1", fullName: "Andrzej" },
          driverId: "d1",
          temporaryDriverName: null,
          rentAmount: 700,
          startDate: "2026-08-10",
          endDate: null,
        }),
        agreement({
          id: "a2",
          carId: "c2",
          car: { id: "c2", plate: "DX12345" },
          temporaryDriverName: "New driver",
          rentAmount: 700,
          startDate: "2026-08-14",
          endDate: null,
        }),
      ],
      [
        { id: "c1", plate: "DX90680" },
        { id: "c2", plate: "DX12345" },
        { id: "c3", plate: "IDLE" },
      ],
      { from: "2026-08-10", to: "2026-08-16" },
      "week",
      (ymd) => ymd.slice(8),
      "2026-12-31",
    );

    expect(model.columns).toHaveLength(7);
    expect(model.activeCars).toBe(2);
    expect(model.idleCars).toBe(1);
    expect(model.carDays).toBe(7 + 3);
    expect(model.expectedRent).toBe(700 + 300);
    expect(model.rows[0]?.plate).toBe("DX12345");
    expect(model.rows[0]?.bars[0]?.driverName).toBe("New driver");
    expect(model.rows[1]?.bars[0]?.leftPct).toBe(0);
    expect(model.rows[1]?.bars[0]?.widthPct).toBe(100);
    expect(model.rows[1]?.bars[0]?.colSpan).toBe(7);
    expect(model.rows[0]?.bars[0]?.colSpan).toBe(3);
  });

  it("picks a stable color per driver", () => {
    expect(barColor("Andrzej")).toBe(barColor("Andrzej"));
    expect(barColor("Andrzej")).not.toBe(barColor("Piotr"));
  });

  it("does not overlap tags when the next driver starts on the previous end day", () => {
    const model = buildFleetTimeline(
      [
        agreement({
          id: "a1",
          carId: "c1",
          car: { id: "c1", plate: "DX90680" },
          driver: { id: "d1", fullName: "First" },
          driverId: "d1",
          temporaryDriverName: null,
          startDate: "2026-08-10",
          endDate: "2026-08-14",
        }),
        agreement({
          id: "a2",
          carId: "c1",
          car: { id: "c1", plate: "DX90680" },
          driver: { id: "d2", fullName: "Second" },
          driverId: "d2",
          temporaryDriverName: null,
          startDate: "2026-08-14",
          endDate: null,
        }),
      ],
      [{ id: "c1", plate: "DX90680" }],
      { from: "2026-08-10", to: "2026-08-16" },
      "week",
      (ymd) => ymd.slice(8),
      "2026-12-31",
    );

    const bars = model.rows[0]?.bars ?? [];
    expect(bars.map((b) => b.driverName)).toEqual(["First", "Second"]);
    expect(bars[0]?.overlapTo).toBe("2026-08-13");
    expect(bars[1]?.overlapFrom).toBe("2026-08-14");
    expect(bars[0]?.colSpan).toBe(4);
    expect(bars[1]?.colSpan).toBe(3);
    expect((bars[0]?.leftPct ?? 0) + (bars[0]?.widthPct ?? 0)).toBeLessThanOrEqual(bars[1]?.leftPct ?? 0);
  });

  it("does not extend axis or bars past as-of", () => {
    const model = buildFleetTimeline(
      [
        agreement({
          id: "a1",
          carId: "c1",
          startDate: "2026-08-01",
          endDate: null,
        }),
      ],
      [{ id: "c1", plate: "DX1" }],
      { from: "2026-08-31", to: "2026-09-06" },
      "week",
      (ymd) => ymd.slice(8),
      "2026-08-31",
    );

    expect(model.range).toEqual({ from: "2026-08-31", to: "2026-08-31" });
    expect(model.columns.map((c) => c.key)).toEqual(["2026-08-31"]);
    expect(model.rows[0]?.bars[0]?.overlapTo).toBe("2026-08-31");
    expect(model.rows[0]?.bars[0]?.colSpan).toBe(1);
    expect(model.carDays).toBe(1);
  });

  it("stops year columns at the as-of month", () => {
    const model = buildFleetTimeline(
      [
        agreement({
          id: "a1",
          carId: "c1",
          startDate: "2026-01-01",
          endDate: null,
        }),
      ],
      [{ id: "c1", plate: "DX1" }],
      { from: "2026-01-01", to: "2026-12-31" },
      "year",
      (ymd) => ymd.slice(5, 7),
      "2026-08-31",
    );

    expect(model.range.to).toBe("2026-08-31");
    expect(model.columns.map((c) => c.key)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
    expect(model.rows[0]?.bars[0]?.colSpan).toBe(8);
  });
});
