import { describe, expect, it } from "vitest";
import { PaymentType } from "@taxi/shared";
import {
  DASHBOARD_FLEET_OTHER_CAR_ID,
  filterDashboardIncomePayments,
  isDashboardIncomePayment,
  matchesDashboardCar,
  paymentInStatsPeriod,
  reportDateRange,
  sumIncomeByMethod,
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

  it("uses local calendar dates for this month (no UTC day shift)", () => {
    const now = new Date();
    const expectedFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const expectedTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(reportDateRange("month")).toEqual({ from: expectedFrom, to: expectedTo });
  });
});

describe("paymentInStatsPeriod", () => {
  it("includes the full calendar month for this month", () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    expect(paymentInStatsPeriod(`${y}-${m}-01`, "month")).toBe(true);
    expect(paymentInStatsPeriod(`${y}-${m}-15`, "month")).toBe(true);
  });

  it("excludes the last day of the previous month", () => {
    const now = new Date();
    const prevLast = new Date(now.getFullYear(), now.getMonth(), 0);
    const iso = `${prevLast.getFullYear()}-${String(prevLast.getMonth() + 1).padStart(2, "0")}-${String(prevLast.getDate()).padStart(2, "0")}`;
    expect(paymentInStatsPeriod(iso, "month")).toBe(false);
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

describe("sumIncomeByMethod", () => {
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
      amount: 550,
      discountAmount: 0,
      date: "2001-01-20",
      method: "CASH" as Payment["method"],
      type: PaymentType.RENT,
      note: null,
      receivedByPartner: false,
      partnerSettled: false,
    },
    {
      id: "3",
      driverId: "d1",
      carId: "car-2",
      amount: 400,
      discountAmount: 0,
      date: "2001-01-20",
      method: "CASH" as Payment["method"],
      type: PaymentType.FINE,
      note: null,
      receivedByPartner: false,
      partnerSettled: false,
    },
    {
      id: "4",
      driverId: "d1",
      carId: "car-1",
      amount: 650,
      discountAmount: 0,
      date: "2001-01-20",
      method: "CASH" as Payment["method"],
      type: PaymentType.DEPOSIT,
      note: null,
      receivedByPartner: false,
      partnerSettled: false,
    },
  ];

  it("splits rent and fines into cash and bank for one car", () => {
    expect(sumIncomeByMethod(payments, "all", "car-1")).toEqual({
      cash: 550,
      bank: 700,
      total: 1250,
    });
  });
});
