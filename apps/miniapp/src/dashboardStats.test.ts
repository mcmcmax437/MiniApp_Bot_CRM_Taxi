import assert from "node:assert/strict";
import test from "node:test";
import { ExpenseCategory } from "@taxi/shared";
import {
  calculateDashboardStats,
  expenseInStatsPeriod,
  type DashboardStatsReport,
} from "./dashboardStats";
import type { Expense } from "./types";

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: overrides.id ?? "expense",
    carId: overrides.carId ?? null,
    category: overrides.category ?? ExpenseCategory.FUEL,
    amount: overrides.amount ?? 0,
    date: overrides.date ?? "2026-07-01",
    note: overrides.note ?? null,
    tag: overrides.tag ?? null,
    paidByPartner: overrides.paidByPartner ?? false,
    partnerSettled: overrides.partnerSettled ?? false,
    car: overrides.car ?? null,
  };
}

const report: DashboardStatsReport = {
  income: 1000,
  expenses: 9999,
  byCar: [
    { carId: "car-1", income: 1000, expenses: 9999 },
    { carId: "car-2", income: 500, expenses: 500 },
  ],
};

test("monthly dashboard stats include TAX expenses for the selected car only", () => {
  const stats = calculateDashboardStats(
    report,
    [
      expense({ id: "fuel", carId: "car-1", category: ExpenseCategory.FUEL, amount: 80, date: "2026-07-03" }),
      expense({ id: "tax", carId: "car-1", category: ExpenseCategory.TAX, amount: 120, date: "2026-07-04" }),
      expense({ id: "other-car-tax", carId: "car-2", category: ExpenseCategory.TAX, amount: 300, date: "2026-07-05" }),
      expense({ id: "previous", carId: "car-1", category: ExpenseCategory.REPAIR, amount: 75, date: "2026-06-30" }),
    ],
    "month",
    "car-1",
    new Date("2026-07-15T12:00:00Z"),
  );

  assert.deepEqual(stats, {
    income: 1000,
    expenses: 200,
    profit: 800,
    roiPercent: 500,
  });
});

test("previous-month dashboard stats include taxes across a year boundary", () => {
  const stats = calculateDashboardStats(
    report,
    [
      expense({ id: "dec-fuel", category: ExpenseCategory.FUEL, amount: 75, date: "2025-12-20" }),
      expense({ id: "dec-tax", category: ExpenseCategory.TAX, amount: 25, date: "2025-12-31" }),
      expense({ id: "jan-tax", category: ExpenseCategory.TAX, amount: 500, date: "2026-01-01" }),
      expense({ id: "old-dec-tax", category: ExpenseCategory.TAX, amount: 500, date: "2024-12-31" }),
    ],
    "previous",
    "",
    new Date("2026-01-10T12:00:00Z"),
  );

  assert.deepEqual(stats, {
    income: 1000,
    expenses: 100,
    profit: 900,
    roiPercent: 1000,
  });
});

test("all-time car stats use report totals instead of local expense rows", () => {
  const stats = calculateDashboardStats(
    report,
    [expense({ carId: "car-1", category: ExpenseCategory.TAX, amount: 200, date: "2026-07-04" })],
    "all",
    "car-1",
    new Date("2026-07-15T12:00:00Z"),
  );

  assert.deepEqual(stats, {
    income: 1000,
    expenses: 9999,
    profit: -8999,
    roiPercent: 10,
  });
});

test("expenseInStatsPeriod distinguishes current and previous periods", () => {
  const now = new Date("2026-07-15T12:00:00Z");

  assert.equal(expenseInStatsPeriod("2026-07-01", "month", now), true);
  assert.equal(expenseInStatsPeriod("2026-06-30", "month", now), false);
  assert.equal(expenseInStatsPeriod("2026-06-30", "previous", now), true);
  assert.equal(expenseInStatsPeriod("2026-07-01", "previous", now), false);
});
