import type { Expense } from "../../types";
import {
  financeInPeriod,
  sortFinanceByDate,
  type FinanceDateSort,
  type FinancePeriod,
} from "./financeDateFilters";

type Translate = (key: string) => string;

export type ExpensePayerFilter = "ALL" | "PARTNER" | "MINE";

export function expenseMatchesPayerFilter(
  expense: Pick<Expense, "paidByPartner">,
  payerFilter: ExpensePayerFilter,
): boolean {
  if (payerFilter === "PARTNER") return expense.paidByPartner;
  if (payerFilter === "MINE") return !expense.paidByPartner;
  return true;
}

export function filterExpensesForList(
  expenses: Expense[],
  options: {
    period: FinancePeriod;
    search: string;
    payerFilter: ExpensePayerFilter;
    dateSort: FinanceDateSort;
    t: Translate;
  },
): Expense[] {
  const q = options.search.trim().toLowerCase();
  const list = expenses.filter((expense) => {
    if (!financeInPeriod(expense.date, options.period)) return false;
    if (!expenseMatchesPayerFilter(expense, options.payerFilter)) return false;
    if (!q) return true;
    const hay = [
      options.t(`finance.${expense.category}`),
      expense.car?.plate ?? "",
      expense.tag ?? "",
      expense.paidByFather ? options.t("finance.paidByFather") : "",
      expense.paidByPartner ? options.t("finance.paidByPartner") : "",
      expense.note ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
  return sortFinanceByDate(list, options.dateSort, (expense) => expense.date);
}
