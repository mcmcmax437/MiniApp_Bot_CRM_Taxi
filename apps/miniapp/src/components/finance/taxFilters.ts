import { ExpenseCategory } from "@taxi/shared";
import type { Expense } from "../../types";
import {
  financeInPeriod,
  type FinanceDateRange,
  type FinancePeriod,
} from "./financePeriod";

export type TaxExpenseFilterOptions = {
  period: FinancePeriod;
  dateRange?: FinanceDateRange | null;
  carFilters?: string[];
};

export function filterTaxExpenses(
  expenses: Expense[],
  options: TaxExpenseFilterOptions,
): Expense[] {
  const carFilters = options.carFilters ?? [];
  return expenses.filter((expense) => {
    if (expense.category !== ExpenseCategory.TAX) return false;
    if (!financeInPeriod(expense.date, options.period, options.dateRange)) return false;
    if (carFilters.length > 0) {
      const carId = expense.carId ?? "";
      if (!carFilters.includes(carId)) return false;
    }
    return true;
  });
}
