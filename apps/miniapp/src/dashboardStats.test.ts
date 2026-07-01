import assert from "node:assert/strict";
import test from "node:test";
import { ExpenseCategory, type ReportSummary } from "@taxi/shared";
import {
  computeDashboardStats,
  expenseInStatsPeriod,
  formatRoi,
  reportDateRange,
  type DashboardExpense,
} from "./dashboardStats";

const report: ReportSummary = {
  from: "2026-06-01",
  to: "2026-06-30",
  income: 1000,
  expenses: 999,
  profit: 1,
  totalInvestment: 0,
  roiPercent: null,
  byCar: [
    { carId: "car-1", label: "CAR 1", income: 600, expenses: 555, profit: 45 },
    { carId: "car-2", label: "CAR 2", income: 400, expenses: 444, profit: -44 },
  ],
  byDriver: [],
  partnerUnsettled: {
    paymentsUnsettled: 0,
    paymentsUnsettledCount: 0,
    expensesUnsettled: 0,
    expensesUnsettledCount: 0,
  },
};

const expenses: DashboardExpense[] = [
  {
    carId: "car-1",
    category: ExpenseCategory.REPAIR,
    amount: 100.111,
    date: "2026-06-05",
  },
  {
    carId: "car-2",
    category: ExpenseCategory.FUEL,
    amount: 50.225,
    date: "2026-06-30",
  },
  {
    carId: null,
    category: ExpenseCategory.OTHER,
    amount: 10,
    date: "2026-06-15",
  },
  {
    carId: "car-1",
    category: ExpenseCategory.TAX,
    amount: 999,
    date: "2026-06-10",
  },
  {
    carId: "car-1",
    category: ExpenseCategory.REPAIR,
    amount: 20,
    date: "2026-07-01",
  },
  {
    carId: "car-1",
    category: ExpenseCategory.REPAIR,
    amount: 30,
    date: "2026-05-31",
  },
];

test("reportDateRange returns the complete previous calendar month", () => {
  assert.deepEqual(reportDateRange("previous", new Date(2026, 0, 15, 12)), {
    from: "2025-12-01",
    to: "2025-12-31",
  });

  assert.deepEqual(reportDateRange("previous", new Date(2024, 2, 10, 12)), {
    from: "2024-02-01",
    to: "2024-02-29",
  });
});

test("expenseInStatsPeriod matches previous month boundaries by calendar date", () => {
  const now = new Date(2026, 6, 10, 12);

  assert.equal(expenseInStatsPeriod("2026-06-01", "previous", now), true);
  assert.equal(expenseInStatsPeriod("2026-06-30", "previous", now), true);
  assert.equal(expenseInStatsPeriod("2026-07-01", "previous", now), false);
  assert.equal(expenseInStatsPeriod("2026-05-31", "previous", now), false);
  assert.equal(expenseInStatsPeriod("not-a-date", "previous", now), false);
});

test("computeDashboardStats uses local previous-month expenses and excludes taxes", () => {
  const stats = computeDashboardStats({
    report,
    expenses,
    statsPeriod: "previous",
    statsCarId: "",
    now: new Date(2026, 6, 10, 12),
  });

  assert.equal(stats.income, 1000);
  assert.equal(stats.expenses, 160.34);
  assert.equal(stats.profit, 839.66);
  assert.equal(stats.roiPercent, 623.67);
  assert.equal(formatRoi(stats.roiPercent), "+523.7%");
});

test("computeDashboardStats applies the previous-month car filter to expenses", () => {
  const stats = computeDashboardStats({
    report,
    expenses,
    statsPeriod: "previous",
    statsCarId: "car-1",
    now: new Date(2026, 6, 10, 12),
  });

  assert.equal(stats.income, 600);
  assert.equal(stats.expenses, 100.11);
  assert.equal(stats.profit, 499.89);
  assert.equal(stats.roiPercent, 599.34);
  assert.equal(formatRoi(stats.roiPercent), "+499.3%");
});

test("computeDashboardStats keeps all-time stats on server report totals", () => {
  assert.deepEqual(
    computeDashboardStats({
      report,
      expenses,
      statsPeriod: "all",
      statsCarId: "",
      now: new Date(2026, 6, 10, 12),
    }),
    {
      income: 1000,
      expenses: 999,
      profit: 1,
      roiPercent: 100.1,
    },
  );

  assert.deepEqual(
    computeDashboardStats({
      report,
      expenses,
      statsPeriod: "all",
      statsCarId: "car-2",
      now: new Date(2026, 6, 10, 12),
    }),
    {
      income: 400,
      expenses: 444,
      profit: -44,
      roiPercent: 90.09,
    },
  );
});
