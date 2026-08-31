import { describe, expect, it } from "vitest";
import { AgreementStatus, RentPeriod } from "@taxi/shared";
import type { Agreement } from "../../types";
import {
  barColor,
  buildFleetTimeline,
  clipAgreementToRange,
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

describe("expectedRentForDays", () => {
  it("pro-rates weekly rent over the overlapping days", () => {
    expect(expectedRentForDays(700, RentPeriod.WEEKLY, 7)).toBe(700);
    expect(expectedRentForDays(700, RentPeriod.WEEKLY, 1)).toBe(100);
  });

  it("multiplies daily rent by days", () => {
    expect(expectedRentForDays(100, RentPeriod.DAILY, 3)).toBe(300);
  });

  it("pro-rates monthly and yearly rent over calendar days", () => {
    expect(expectedRentForDays(3000, RentPeriod.MONTHLY, 15)).toBe(1500);
    expect(expectedRentForDays(3650, RentPeriod.YEARLY, 10)).toBe(100);
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
  });

  it("picks a stable color per driver", () => {
    expect(barColor("Andrzej")).toBe(barColor("Andrzej"));
    expect(barColor("Andrzej")).not.toBe(barColor("Piotr"));
  });

  it("deduplicates same-car active days while keeping each agreement bar", () => {
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
          endDate: "2026-08-16",
        }),
        agreement({
          id: "a2",
          carId: "c1",
          car: { id: "c1", plate: "DX90680" },
          temporaryDriverName: "Overlap driver",
          rentAmount: 350,
          startDate: "2026-08-14",
          endDate: "2026-08-16",
        }),
      ],
      [
        { id: "c1", plate: "DX90680" },
        { id: "c2", plate: "IDLE" },
      ],
      { from: "2026-08-10", to: "2026-08-16" },
      "week",
      (ymd) => ymd.slice(8),
    );

    expect(model.activeCars).toBe(1);
    expect(model.idleCars).toBe(1);
    expect(model.carDays).toBe(7);
    expect(model.expectedRent).toBe(700 + 150);
    expect(model.heat.map((cell) => cell.cars)).toEqual([1, 1, 1, 1, 1, 1, 1]);
    expect(model.rows[0]?.days).toBe(7);
    expect(model.rows[0]?.bars.map((bar) => bar.agreementId)).toEqual(["a1", "a2"]);
  });

  it("counts unique cars per month in yearly heat cells", () => {
    const model = buildFleetTimeline(
      [
        agreement({
          id: "jan-span",
          carId: "c1",
          car: { id: "c1", plate: "DX90680" },
          startDate: "2026-01-20",
          endDate: "2026-02-10",
        }),
        agreement({
          id: "feb-other",
          carId: "c2",
          car: { id: "c2", plate: "DX12345" },
          startDate: "2026-02-05",
          endDate: "2026-02-20",
        }),
      ],
      [
        { id: "c1", plate: "DX90680" },
        { id: "c2", plate: "DX12345" },
        { id: "c3", plate: "IDLE" },
      ],
      { from: "2026-01-01", to: "2026-12-31" },
      "year",
      (ymd) => ymd.slice(5, 7),
    );

    expect(model.columns).toHaveLength(12);
    expect(model.heat.map((cell) => cell.cars)).toEqual([1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(model.activeCars).toBe(2);
    expect(model.idleCars).toBe(1);
  });
});
