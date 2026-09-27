import { describe, expect, it } from "vitest";
import { ExpenseCategory, isCarPurchaseExpense } from "@taxi/shared";

describe("isCarPurchaseExpense", () => {
  it("matches the dedicated category", () => {
    expect(isCarPurchaseExpense({ category: ExpenseCategory.CAR_PURCHASE })).toBe(true);
  });

  it("matches purchase tags", () => {
    expect(isCarPurchaseExpense({ category: ExpenseCategory.OTHER, tag: "car-purchase" })).toBe(true);
    expect(isCarPurchaseExpense({ category: ExpenseCategory.OTHER, tag: "Purchase" })).toBe(true);
  });

  it("matches legacy auto-created notes including payment suffixes", () => {
    expect(
      isCarPurchaseExpense({ category: ExpenseCategory.OTHER, note: "Purchase of AA1111" }),
    ).toBe(true);
    expect(
      isCarPurchaseExpense({
        category: ExpenseCategory.OTHER,
        note: "Purchase of AA1111 · 2150 EUR",
      }),
    ).toBe(true);
    expect(isCarPurchaseExpense({ category: ExpenseCategory.OTHER, note: "Купівля AA1111" })).toBe(
      true,
    );
    expect(isCarPurchaseExpense({ category: ExpenseCategory.OTHER, note: "Покупка AA1111" })).toBe(
      true,
    );
  });

  it("ignores ordinary expenses", () => {
    expect(isCarPurchaseExpense({ category: ExpenseCategory.FUEL, note: "Shell" })).toBe(false);
    expect(isCarPurchaseExpense({ category: ExpenseCategory.OTHER, note: "Tires" })).toBe(false);
  });
});
