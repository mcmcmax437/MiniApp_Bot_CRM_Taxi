import { describe, expect, it } from "vitest";
import { ExpenseCategory } from "@taxi/shared";
import { filterExpensesForList } from "./expenseFilters.js";
import type { Expense } from "../../types";

const labels: Record<string, string> = {
  "finance.FUEL": "Fuel",
  "finance.REPAIR": "Repair",
  "finance.INSURANCE": "Insurance",
  "finance.paidByPartner": "Paid by partner",
  "finance.paidByFather": "Paid by father",
};

const t = (key: string) => labels[key] ?? key;

function expense(overrides: Partial<Expense> & Pick<Expense, "id" | "date" | "paidByPartner">): Expense {
  return {
    carId: null,
    category: ExpenseCategory.FUEL,
    amount: 100,
    note: null,
    tag: null,
    partnerSettled: false,
    paidByFather: false,
    car: null,
    ...overrides,
  };
}

describe("filterExpensesForList", () => {
  const expenses: Expense[] = [
    expense({
      id: "partner-new",
      date: "2026-03-20",
      paidByPartner: true,
      note: "Oil change",
      car: { id: "car-1", plate: "AA1234BB" },
    }),
    expense({
      id: "mine",
      date: "2026-03-18",
      paidByPartner: false,
      note: "Oil filter",
      tag: "garage",
    }),
    expense({
      id: "father-paid",
      date: "2026-03-19",
      paidByPartner: false,
      paidByFather: true,
      category: ExpenseCategory.REPAIR,
    }),
    expense({
      id: "partner-old",
      date: "2026-03-17",
      paidByPartner: true,
      category: ExpenseCategory.INSURANCE,
    }),
  ];

  it("filters by partner and owner payment while preserving date sort", () => {
    expect(
      filterExpensesForList(expenses, {
        period: "all",
        search: "",
        payerFilter: "PARTNER",
        dateSort: "newest",
        t,
      }).map((item) => item.id),
    ).toEqual(["partner-new", "partner-old"]);

    expect(
      filterExpensesForList(expenses, {
        period: "all",
        search: "",
        payerFilter: "MINE",
        dateSort: "newest",
        t,
      }).map((item) => item.id),
    ).toEqual(["father-paid", "mine"]);
  });

  it("combines payer filtering with search text", () => {
    expect(
      filterExpensesForList(expenses, {
        period: "all",
        search: "oil",
        payerFilter: "PARTNER",
        dateSort: "newest",
        t,
      }).map((item) => item.id),
    ).toEqual(["partner-new"]);

    expect(
      filterExpensesForList(expenses, {
        period: "all",
        search: "oil",
        payerFilter: "MINE",
        dateSort: "newest",
        t,
      }).map((item) => item.id),
    ).toEqual(["mine"]);
  });
});
