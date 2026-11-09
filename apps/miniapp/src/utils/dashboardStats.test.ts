import { describe, expect, it } from "vitest";
import { PaymentType } from "@taxi/shared";
import { ExpenseCategory } from "@taxi/shared";
import {
  DASHBOARD_FLEET_OTHER_CAR_ID,
  DASHBOARD_FLEET_TAX_CAR_ID,
  buildDashboardByCar,
  orderDashboardChartRows,
  filterDashboardIncomePayments,
  isDashboardIncomePayment,
  matchesDashboardCar,
  paymentInStatsPeriod,
  reportDateRange,
  sumExpensesByPayer,
  sumIncomeByMethod,
} from "./dashboardStats.js";
import type { Expense, Payment } from "../types";

describe("isDashboardIncomePayment", () => {
  it("matches rent, fines, and car sales", () => {
    expect(isDashboardIncomePayment(PaymentType.RENT)).toBe(true);
    expect(isDashboardIncomePayment(PaymentType.FINE)).toBe(true);
    expect(isDashboardIncomePayment(PaymentType.SALE)).toBe(true);
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

describe("sumExpensesByPayer", () => {
  const expenses: Expense[] = [
    {
      id: "e1",
      carId: "car-1",
      category: ExpenseCategory.FUEL,
      amount: 200,
      date: "2001-01-10",
      note: null,
      tag: null,
      paidByPartner: true,
      partnerSettled: false,
      paidByFather: false,
    },
    {
      id: "e2",
      carId: "car-1",
      category: ExpenseCategory.TAX,
      amount: 50,
      date: "2001-01-12",
      note: null,
      tag: null,
      paidByPartner: false,
      partnerSettled: false,
      paidByFather: false,
    },
    {
      id: "e3",
      carId: "car-2",
      category: ExpenseCategory.MAINTENANCE,
      amount: 80,
      date: "2001-01-15",
      note: null,
      tag: null,
      paidByPartner: true,
      partnerSettled: false,
      paidByFather: false,
    },
  ];

  it("splits partner vs owner expenses for one car", () => {
    expect(sumExpensesByPayer(expenses, "all", "car-1")).toEqual({
      partner: 200,
      mine: 50,
      total: 250,
    });
  });

  it("includes taxes in the owner bucket when the partner did not pay", () => {
    expect(sumExpensesByPayer(expenses, "all", "")).toEqual({
      partner: 280,
      mine: 50,
      total: 330,
    });
  });

  it("counts an even share when one expense is on several cars", () => {
    const shared: Expense[] = [
      {
        id: "shared",
        carId: "car-1",
        cars: [
          { id: "car-1", plate: "A" },
          { id: "car-2", plate: "B" },
        ],
        category: ExpenseCategory.FUEL,
        amount: 100,
        date: "2001-01-10",
        note: null,
        tag: null,
        paidByPartner: false,
        partnerSettled: false,
        paidByFather: false,
      },
    ];
    expect(sumExpensesByPayer(shared, "all", "car-1").total).toBe(50);
    expect(sumExpensesByPayer(shared, "all", "").total).toBe(100);
  });
});

describe("buildDashboardByCar", () => {
  function expense(partial: Pick<Expense, "id" | "carId" | "category" | "amount">): Expense {
    return {
      date: "2001-01-10",
      note: null,
      tag: null,
      paidByPartner: false,
      partnerSettled: false,
      paidByFather: false,
      ...partial,
    };
  }

  it("splits unassigned expenses into taxes and other", () => {
    const rows = buildDashboardByCar(
      [],
      [
        expense({ id: "tax", carId: null, category: ExpenseCategory.TAX, amount: 300 }),
        expense({ id: "other", carId: null, category: ExpenseCategory.OTHER, amount: 80 }),
        expense({ id: "car-tax", carId: "car-1", category: ExpenseCategory.TAX, amount: 40 }),
      ],
      [{ id: "car-1", plate: "AA1111", make: "Toyota", model: "Prius" } as never],
      "all",
      "Other",
      "Taxes",
    );

    const other = rows.find((row) => row.carId === DASHBOARD_FLEET_OTHER_CAR_ID);
    const tax = rows.find((row) => row.carId === DASHBOARD_FLEET_TAX_CAR_ID);
    const car = rows.find((row) => row.carId === "car-1");
    expect(other?.expenses).toBe(80);
    expect(tax?.expenses).toBe(300);
    expect(tax?.label).toBe("Taxes");
    expect(car?.expenses).toBe(40);
    expect(rows.map((row) => row.carId)).toEqual([
      "car-1",
      DASHBOARD_FLEET_TAX_CAR_ID,
      DASHBOARD_FLEET_OTHER_CAR_ID,
    ]);
  });

  it("keeps taxes and other after every car even when a car loses more", () => {
    const ordered = orderDashboardChartRows([
      {
        carId: DASHBOARD_FLEET_OTHER_CAR_ID,
        label: "Other",
        income: 500,
        expenses: 0,
        profit: 500,
      },
      {
        carId: "car-loss",
        label: "Loss",
        income: 0,
        expenses: 1000,
        profit: -1000,
      },
      {
        carId: DASHBOARD_FLEET_TAX_CAR_ID,
        label: "Taxes",
        income: 0,
        expenses: 10,
        profit: -10,
      },
      {
        carId: "car-win",
        label: "Win",
        income: 20,
        expenses: 0,
        profit: 20,
      },
    ]);
    expect(ordered.map((row) => row.carId)).toEqual([
      "car-win",
      "car-loss",
      DASHBOARD_FLEET_TAX_CAR_ID,
      DASHBOARD_FLEET_OTHER_CAR_ID,
    ]);
  });
});
