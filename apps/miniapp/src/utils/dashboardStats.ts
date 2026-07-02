import { PaymentType } from "@taxi/shared";
import type { ReportSummary } from "@taxi/shared";
import type { DashboardStatsPeriod } from "../components/crm";
import type { Car, Expense, Payment } from "../types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function calendarMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function currentCalendarMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function previousCalendarMonthKey(): string {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
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
  const key = calendarMonthKey(dateStr);
  if (period === "month") return key === currentCalendarMonthKey();
  return key === previousCalendarMonthKey();
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

function carRowLabel(car: Pick<Car, "plate" | "make" | "model">): string {
  const name = [car.make, car.model].filter(Boolean).join(" ");
  return [car.plate, name].filter(Boolean).join(" · ");
}

/**
 * Per-car income/expenses for the dashboard chart — uses the same period
 * rules as the stat cards above (calendar month for expenses).
 */
export function buildDashboardByCar(
  payments: Payment[],
  expenses: Expense[],
  cars: Car[],
  period: DashboardStatsPeriod,
): ReportSummary["byCar"] {
  const incomeByCar = new Map<string, number>();
  for (const p of filterDashboardIncomePayments(payments, period, "")) {
    if (p.carId) incomeByCar.set(p.carId, (incomeByCar.get(p.carId) ?? 0) + p.amount);
  }

  const expenseByCar = new Map<string, number>();
  for (const e of filterDashboardExpenses(expenses, period, "")) {
    if (e.carId) expenseByCar.set(e.carId, (expenseByCar.get(e.carId) ?? 0) + e.amount);
  }

  const labelById = new Map(cars.map((c) => [c.id, carRowLabel(c)] as const));
  const carIds = new Set<string>([...incomeByCar.keys(), ...expenseByCar.keys()]);

  return [...carIds]
    .map((carId) => {
      const income = round2(incomeByCar.get(carId) ?? 0);
      const exp = round2(expenseByCar.get(carId) ?? 0);
      return {
        carId,
        label: labelById.get(carId) ?? "—",
        income,
        expenses: exp,
        profit: round2(income - exp),
      };
    })
    .sort((a, b) => b.profit - a.profit);
}

export type StatBreakdownKind = "income" | "expenses";

export function parseStatBreakdownKind(raw: string | null): StatBreakdownKind | null {
  return raw === "income" || raw === "expenses" ? raw : null;
}

export function parseStatsPeriod(raw: string | null): DashboardStatsPeriod {
  if (raw === "month" || raw === "previous" || raw === "all") return raw;
  return "all";
}
