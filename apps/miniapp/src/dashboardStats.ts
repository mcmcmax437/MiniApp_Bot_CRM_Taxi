import type { Expense } from "./types";

export type DashboardStatsPeriod = "all" | "previous" | "month";

export interface DashboardStatsReport {
  income: number;
  expenses: number;
  byCar: Array<{
    carId: string;
    income: number;
    expenses: number;
  }>;
}

export interface DashboardStats {
  income: number;
  expenses: number;
  profit: number;
  roiPercent: number | null;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calcRoi(income: number, expenses: number): number | null {
  if (!(expenses > 0)) return null;
  return round2((income / expenses) * 100);
}

export function expenseInStatsPeriod(
  dateStr: string,
  period: "month" | "previous",
  now = new Date(),
): boolean {
  const d = new Date(dateStr);
  if (period === "month") {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return d.getFullYear() === prevMonth.getFullYear() && d.getMonth() === prevMonth.getMonth();
}

export function calculateDashboardStats(
  report: DashboardStatsReport | null | undefined,
  expenses: Expense[] | undefined,
  statsPeriod: DashboardStatsPeriod,
  statsCarId: string,
  now = new Date(),
): DashboardStats {
  if (!report) {
    return {
      income: 0,
      expenses: 0,
      profit: 0,
      roiPercent: null,
    };
  }

  let localExpenses: number | null = null;
  if (statsPeriod === "month" || statsPeriod === "previous") {
    const list = (expenses ?? []).filter(
      (e) =>
        expenseInStatsPeriod(e.date, statsPeriod, now) &&
        (!statsCarId || e.carId === statsCarId),
    );
    localExpenses = round2(list.reduce((s, e) => s + e.amount, 0));
  }

  if (!statsCarId) {
    const expensesValue = localExpenses != null ? localExpenses : report.expenses;
    const profitValue = round2(report.income - expensesValue);
    return {
      income: report.income,
      expenses: expensesValue,
      profit: profitValue,
      roiPercent: calcRoi(report.income, expensesValue),
    };
  }

  const carRow = report.byCar.find((row) => row.carId === statsCarId);
  const income = carRow?.income ?? 0;
  const expensesValue = localExpenses != null ? localExpenses : (carRow?.expenses ?? 0);
  const profit = round2(income - expensesValue);

  return {
    income,
    expenses: expensesValue,
    profit,
    roiPercent: calcRoi(income, expensesValue),
  };
}
