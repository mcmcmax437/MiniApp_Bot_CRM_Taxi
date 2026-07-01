import {
  ExpenseCategory,
  type ExpenseCategory as ExpenseCategoryValue,
  type ReportSummary,
} from "@taxi/shared";

export type DashboardStatsPeriod = "all" | "previous" | "month";

export interface DashboardStats {
  income: number;
  expenses: number;
  profit: number;
  roiPercent: number | null;
}

export interface DashboardExpense {
  carId: string | null;
  category: ExpenseCategoryValue;
  amount: number;
  date: string;
}

export function emptyDashboardStats(): DashboardStats {
  return {
    income: 0,
    expenses: 0,
    profit: 0,
    roiPercent: null,
  };
}

/**
 * Formats a raw ROI ratio (income/expenses x 100) into a user-facing return
 * percentage. The raw value uses 100% as the break-even line:
 *
 *   - 100%   -> the business broke even (income == expenses)
 *   - > 100% -> profit; anything above 100% is a positive return
 *   - < 100% -> loss; anything below 100% is a negative return
 *
 * Because the raw ratio is unintuitive at a glance ("50% return? that
 * sounds great!"), we display the delta from break-even with a sign,
 * so the user immediately sees profit vs. loss without doing the math.
 *   -  50  -> "-50.0%"  (income covered 50% of expenses -- half a loss)
 *   - 100  ->  "0.0%"   (broke even)
 *   - 150  -> "+50.0%"  (50% above break-even -- a real profit)
 *   - 200  -> "+100.0%" (doubled the expenses as income)
 *
 * Returns "-" when the input is null/undefined (no expenses yet).
 */
export function formatRoi(percent: number | null | undefined): string {
  if (percent == null) return "—";
  // Round the delta first so the displayed number doesn't wobble across the
  // 100% boundary (e.g. 99.96 -> "-0.0%" looks wrong).
  const delta = round2(percent - 100);
  const rounded = Math.round((delta + Number.EPSILON) * 10) / 10;
  // Use the rounded value for the sign too -- if it's exactly 0 we drop the
  // sign entirely ("break even" reads better than "+0.0%").
  let body: string;
  if (rounded > 0) body = `+${rounded.toFixed(1)}%`;
  else if (rounded < 0) body = `${rounded.toFixed(1)}%`;
  else body = "0.0%";
  return body;
}

/**
 * ROI = (Income / Expenses) x 100%
 *
 * Definition: how many zl of real income was earned for every 1 zl spent
 * on operating expenses (over the selected period). When ROI > 100%, the
 * fleet brought in more than it cost to run; below 100% it ran at a loss.
 *
 * "Income" here means money actually received from drivers -- i.e. payments
 * of type RENT or FINE only. Deposits and refunds that drivers leave when
 * they take a car are NOT income (they're money held on the owner's behalf
 * and returned), and DISCOUNT entries reduce what we owe back to drivers,
 * not money we received.
 *
 * "Expenses" excludes TAX, matching the Finance page's Expenses tab and
 * the existing monthly-expenses logic below.
 *
 * Returns null when expenses are zero so we can render "-" instead of a
 * misleading "Infinity%".
 */
export function calcRoi(income: number, expenses: number): number | null {
  if (!(expenses > 0)) return null;
  return round2((income / expenses) * 100);
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function dateParts(date: Date): { year: number; month: number; day: number } {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

function isoDateFromParts(parts: { year: number; month: number; day: number }): string {
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function isoDateFromLocalDate(date: Date): string {
  return isoDateFromParts(dateParts(date));
}

function parseDateParts(dateStr: string): { year: number; month: number; day: number } | null {
  const dateOnly = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnly) {
    return {
      year: Number(dateOnly[1]),
      month: Number(dateOnly[2]),
      day: Number(dateOnly[3]),
    };
  }

  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return null;
  return dateParts(parsed);
}

export function todayIso(now = new Date()): string {
  return isoDateFromLocalDate(now);
}

export function reportDateRange(
  period: DashboardStatsPeriod,
  now = new Date(),
): { from: string; to: string } {
  if (period === "month") {
    const from = isoDateFromLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
    return { from, to: todayIso(now) };
  }
  if (period === "previous") {
    const from = isoDateFromLocalDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const to = isoDateFromLocalDate(new Date(now.getFullYear(), now.getMonth(), 0));
    return { from, to };
  }
  return { from: "2000-01-01", to: todayIso(now) };
}

export function expenseInStatsPeriod(
  dateStr: string,
  period: "month" | "previous",
  now = new Date(),
): boolean {
  const parts = parseDateParts(dateStr);
  if (!parts) return false;

  if (period === "month") {
    return parts.year === now.getFullYear() && parts.month === now.getMonth() + 1;
  }

  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return parts.year === prevMonth.getFullYear() && parts.month === prevMonth.getMonth() + 1;
}

export function computeDashboardStats(input: {
  report: ReportSummary;
  expenses: DashboardExpense[];
  statsPeriod: DashboardStatsPeriod;
  statsCarId: string;
  now?: Date;
}): DashboardStats {
  // For the "month" and "previous" views, recompute expenses locally so the
  // number matches the Finance page's Expenses tab:
  //   - Excludes TAX (which has its own tab there)
  //   - Covers the whole calendar month, not just 1st-to-today
  //   - Filters by selected car when one is picked
  let localExpenses: number | null = null;
  if (input.statsPeriod === "month" || input.statsPeriod === "previous") {
    const list = input.expenses.filter(
      (e) =>
        e.category !== ExpenseCategory.TAX &&
        expenseInStatsPeriod(e.date, input.statsPeriod, input.now) &&
        (!input.statsCarId || e.carId === input.statsCarId),
    );
    localExpenses = round2(list.reduce((s, e) => s + e.amount, 0));
  }

  if (!input.statsCarId) {
    const expensesValue = localExpenses != null ? localExpenses : input.report.expenses;
    const profitValue = round2(input.report.income - expensesValue);
    return {
      income: input.report.income,
      expenses: expensesValue,
      profit: profitValue,
      roiPercent: calcRoi(input.report.income, expensesValue),
    };
  }

  const carRow = input.report.byCar.find((row) => row.carId === input.statsCarId);
  const income = carRow?.income ?? 0;
  // When a car is selected, prefer the locally-computed monthly number
  // (excludes TAX) over the server-side per-car total.
  const expenses = localExpenses != null ? localExpenses : (carRow?.expenses ?? 0);
  const profit = round2(income - expenses);

  return {
    income,
    expenses,
    profit,
    roiPercent: calcRoi(income, expenses),
  };
}
