import { describe, expect, it, vi } from "vitest";

vi.mock("../prisma.js", () => ({
  prisma: {},
}));

import {
  agreementAccrualCap,
  buildAgreementAccrual,
  periodsElapsed,
  type AgreementWithCar,
} from "./balance.js";

/** Local calendar date at midnight — matches balance startOfDay. */
function d(y: number, m: number, day: number): Date {
  return new Date(y, m - 1, day);
}

describe("periodsElapsed", () => {
  it("returns 0 when asOf is before start", () => {
    expect(periodsElapsed(d(2026, 3, 16), d(2026, 3, 10), "WEEKLY")).toBe(0);
  });

  it("charges a full first week when start Mon and asOf Sun", () => {
    // Mon 16 Mar 2026 → Sun 22 Mar 2026 = 7 days → 1 week
    expect(periodsElapsed(d(2026, 3, 16), d(2026, 3, 22), "WEEKLY")).toBe(1);
  });

  it("prorates a partial first week", () => {
    // Wed 18 Mar → Sun 22 Mar = 5 days → 5/7
    expect(periodsElapsed(d(2026, 3, 18), d(2026, 3, 22), "WEEKLY")).toBeCloseTo(5 / 7, 10);
  });

  it("adds full weeks after the first period", () => {
    // Wed 18 Mar → Wed 25 Mar = 8 days → 1 + 1/7
    expect(periodsElapsed(d(2026, 3, 18), d(2026, 3, 25), "WEEKLY")).toBeCloseTo(1 + 1 / 7, 10);
  });

  it("matches Anastasiia case: 69 calendar days weekly at 700 → 6900 accrued", () => {
    // 16/03/26 — 23/05/26 inclusive = 69 days (must not lose a day to DST)
    const start = d(2026, 3, 16);
    const end = d(2026, 5, 23);
    const periods = periodsElapsed(start, end, "WEEKLY");
    expect(periods * 700).toBeCloseTo(6900, 5);
  });

  it("does not lose a day when the range crosses spring DST", () => {
    // Europe DST 2026 starts 29 Mar — wall-clock ms would undercount by 1
    expect(periodsElapsed(d(2026, 3, 16), d(2026, 4, 1), "DAILY")).toBe(17);
  });

  it("charges 1 full day for DAILY on the start day", () => {
    expect(periodsElapsed(d(2026, 3, 16), d(2026, 3, 16), "DAILY")).toBe(1);
  });

  it("uses 30-day months for MONTHLY prorating", () => {
    expect(periodsElapsed(d(2026, 3, 1), d(2026, 3, 15), "MONTHLY")).toBeCloseTo(15 / 30, 10);
  });
});

describe("agreementAccrualCap", () => {
  const base: AgreementWithCar = {
    id: "ag1",
    startDate: d(2026, 3, 16),
    endDate: d(2026, 5, 23),
    updatedAt: d(2026, 5, 24),
    status: "ACTIVE",
    period: "WEEKLY",
    rentAmount: 700,
  };

  it("caps ACTIVE rentals at endDate when end is in the past", () => {
    const cap = agreementAccrualCap(base, d(2026, 7, 13));
    expect(cap.getTime()).toBe(d(2026, 5, 23).getTime());
  });

  it("uses asOf for open ACTIVE rentals", () => {
    const open = { ...base, endDate: null };
    const asOf = d(2026, 7, 13);
    expect(agreementAccrualCap(open, asOf).getTime()).toBe(asOf.getTime());
  });

  it("uses endDate for ENDED rentals", () => {
    const ended = { ...base, status: "ENDED" as const };
    expect(agreementAccrualCap(ended, d(2026, 7, 13)).getTime()).toBe(d(2026, 5, 23).getTime());
  });

  it("falls back to updatedAt when ENDED has no endDate", () => {
    const ended = { ...base, status: "ENDED" as const, endDate: null };
    expect(agreementAccrualCap(ended, d(2026, 7, 13)).getTime()).toBe(d(2026, 5, 24).getTime());
  });
});

describe("buildAgreementAccrual", () => {
  it("includes ended rental accrued rent so balance does not ignore history", () => {
    const agreement: AgreementWithCar = {
      id: "ag-ended",
      startDate: d(2026, 3, 16),
      endDate: d(2026, 5, 23),
      updatedAt: d(2026, 5, 24),
      status: "ENDED",
      period: "WEEKLY",
      rentAmount: 700,
      car: { plate: "PY5135F" },
    };
    const cap = agreementAccrualCap(agreement, d(2026, 7, 13));
    const row = buildAgreementAccrual(agreement, cap);
    expect(row.carPlate).toBe("PY5135F");
    expect(row.daysElapsed).toBe(69);
    expect(row.accrued).toBeCloseTo(6900, 5);
  });
});
