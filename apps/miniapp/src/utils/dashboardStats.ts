import { PaymentType } from "@taxi/shared";
import type { DashboardStatsPeriod } from "../components/crm";
import type { Expense, Payment } from "../types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function reportDateRange(period: DashboardStatsPeriod): { from: string; to: string } {
  const now = new Date();
  if (period === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    return { from, to: todayIso() };
  }
  if (period === "previous") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
    const to = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
    return { from, to };
  }
  return { from: "2000-01-01", to: todayIso() };
}

export function dateInCalendarMonth(dateStr: string, period: "month" | "previous"): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  if (period === "month") {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return d.getFullYear() === prevMonth.getFullYear() && d.getMonth() === prevMonth.getMonth();
}

/** Income on the dashboard follows the report API date range (e.g. this month = 1st → today). */
export function paymentInStatsPeriod(dateStr: string, period: DashboardStatsPeriod): boolean {
  const { from, to } = reportDateRange(period);
  const d = dateStr.slice(0, 10);
  return d >= from && d <= to;
}

/**
 * Expenses for month/previous use the full calendar month on the dashboard,
 * while income uses the report API range above.
 */
export function expenseInStatsPeriod(dateStr: string, period: DashboardStatsPeriod): boolean {
  if (period === "month" || period === "previous") {
    return dateInCalendarMonth(dateStr, period);
  }
  const { from, to } = reportDateRange(period);
  const d = dateStr.slice(0, 10);
  return d >= from && d <= to;
}

export function dateInStatsPeriod(dateStr: string, period: DashboardStatsPeriod): boolean {
  return expenseInStatsPeriod(dateStr, period);
}

export function matchesDashboardCar(carId: string | null | undefined, filterCarId: string): boolean {
  if (!filterCarId) return true;
  return carId === filterCarId;
}

export function isDashboardIncomePayment(type: PaymentType): boolean {
  return type === PaymentType.RENT || type === PaymentType.FINE;
}

export function filterDashboardIncomePayments(
  payments: Payment[],
  period: DashboardStatsPeriod,
  carId: string,
): Payment[] {
  return payments.filter(
    (p) =>
      isDashboardIncomePayment(p.type) &&
      matchesDashboardCar(p.carId, carId) &&
      paymentInStatsPeriod(p.date, period),
  );
}

export function filterDashboardExpenses(
  expenses: Expense[],
  period: DashboardStatsPeriod,
  carId: string,
): Expense[] {
  return expenses.filter(
    (e) => matchesDashboardCar(e.carId, carId) && expenseInStatsPeriod(e.date, period),
  );
}

export type StatBreakdownKind = "income" | "expenses";

export function parseStatBreakdownKind(raw: string | null): StatBreakdownKind | null {
  return raw === "income" || raw === "expenses" ? raw : null;
}

export function parseStatsPeriod(raw: string | null): DashboardStatsPeriod {
  if (raw === "month" || raw === "previous" || raw === "all") return raw;
  return "all";
}
