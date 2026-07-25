import { describe, expect, it } from "vitest";
import { PaymentType } from "@taxi/shared";
import {
  DASHBOARD_FLEET_OTHER_CAR_ID,
  filterDashboardIncomePayments,
  isDashboardIncomePayment,
  matchesDashboardCar,
  reportDateRange,
} from "./dashboardStats.js";
import type { Payment } from "../types";

describe("isDashboardIncomePayment", () => {
  it("matches rent and fines only", () => {
    expect(isDashboardIncomePayment(PaymentType.RENT)).toBe(true);
    expect(isDashboardIncomePayment(PaymentType.DEPOSIT)).toBe(false);
  });
});

describe("matchesDashboardCar", () => {
  it("matches all cars when filter is empty", () => {
    expect(matchesDashboardCar("car-1", "")).toBe(true);
    expect(matchesDashboardCar(null, "")).toBe(true);
  });

  it("matches unassigned rows for fleet other", () => {
    expect(matchesDashboardCar(null, DASHBOARD_FLEET_OTHER_CAR_ID)).toBe(true);
    expect(matchesDashboardCar("", DASHBOARD_FLEET_OTHER_CAR_ID)).toBe(true);
    expect(matchesDashboardCar("car-1", DASHBOARD_FLEET_OTHER_CAR_ID)).toBe(false);
  });

  it("matches exact car id", () => {
    expect(matchesDashboardCar("car-1", "car-1")).toBe(true);
    expect(matchesDashboardCar("car-2", "car-1")).toBe(false);
  });
});

describe("reportDateRange", () => {
  it("uses epoch start for all-time", () => {
    const range = reportDateRange("all");
    expect(range.from).toBe("2000-01-01");
    expect(range.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns previous calendar month bounds", () => {
    const range = reportDateRange("previous");
    expect(range.from <= range.to).toBe(true);
    expect(range.from.slice(0, 7)).not.toBe(new Date().toISOString().slice(0, 7));
  });
});

describe("filterDashboardIncomePayments", () => {
  const payments: Payment[] = [
    {
      id: "1",
      driverId: "d1",
      carId: "car-1",
      amount: 700,
      discountAmount: 0,
      date: "2001-01-15",
      method: "BANK" as Payment["method"],
      type: PaymentType.RENT,
      note: null,
      receivedByPartner: false,
      partnerSettled: false,
    },
    {
      id: "2",
      driverId: "d1",
      carId: "car-1",
      amount: 650,
      discountAmount: 0,
      date: "2001-01-15",
      method: "CASH" as Payment["method"],
      type: PaymentType.DEPOSIT,
      note: null,
      receivedByPartner: false,
      partnerSettled: false,
    },
  ];

  it("excludes deposits from income totals", () => {
    const income = filterDashboardIncomePayments(payments, "all", "");
    expect(income).toHaveLength(1);
    expect(income[0]?.type).toBe(PaymentType.RENT);
  });
});
