import { describe, expect, it } from "vitest";
import { ExpenseCategory } from "@taxi/shared";
import type { Expense } from "../../types";
import { filterTaxExpenses } from "./taxFilters";

function thisMonthDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-15`;
}

function expense(partial: Partial<Expense> & Pick<Expense, "id" | "amount" | "date">): Expense {
  return {
    carId: partial.carId ?? "car-a",
    category: ExpenseCategory.TAX,
    note: null,
    tag: null,
    paidByPartner: false,
    partnerSettled: false,
    paidByFather: false,
    ...partial,
  };
}

describe("filterTaxExpenses", () => {
  it("keeps only tax expenses when no car filters are selected", () => {
    const expenses = [
      expense({ id: "tax-a", carId: "car-a", amount: 100, date: "2026-07-10" }),
      expense({ id: "tax-b", carId: "car-b", amount: 200, date: "2026-07-11" }),
      expense({
        id: "repair-a",
        carId: "car-a",
        amount: 999,
        date: "2026-07-12",
        category: ExpenseCategory.REPAIR,
      }),
    ];

    expect(filterTaxExpenses(expenses, { period: "all" }).map((e) => e.id)).toEqual([
      "tax-a",
      "tax-b",
    ]);
  });

  it("applies car filters to current-month tax totals, including unassigned taxes", () => {
    const date = thisMonthDate();
    const expenses = [
      expense({ id: "tax-a", carId: "car-a", amount: 100, date }),
      expense({ id: "tax-b", carId: "car-b", amount: 200, date }),
      expense({ id: "tax-none", carId: null, amount: 50, date }),
    ];

    expect(
      filterTaxExpenses(expenses, { period: "month", carFilters: ["car-a"] }).map(
        (e) => e.id,
      ),
    ).toEqual(["tax-a"]);
    expect(
      filterTaxExpenses(expenses, { period: "month", carFilters: [""] }).map(
        (e) => e.id,
      ),
    ).toEqual(["tax-none"]);
  });
});
