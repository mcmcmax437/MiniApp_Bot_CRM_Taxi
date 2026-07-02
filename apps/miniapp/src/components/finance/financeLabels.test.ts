import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ExpenseCategory } from "@taxi/shared";
import { expenseDisplaySubtitle } from "./financeLabels";

describe("expenseDisplaySubtitle", () => {
  const t = (key: string, options?: Record<string, unknown>) => {
    if (key === "finance.paidByPerson") return `Paid by ${options?.name}`;
    return key;
  };

  it("adds a localized payer segment between plate and category", () => {
    const subtitle = expenseDisplaySubtitle(
      {
        car: { plate: "AA1234BB" },
        category: ExpenseCategory.REPAIR,
        note: "Changed tires",
        payer: "  father  ",
        tag: null,
      },
      "2026-07-02",
      t,
      "No car",
    );

    assert.equal(subtitle, "2026-07-02 · AA1234BB · Paid by father · finance.REPAIR");
  });

  it("omits blank payers without dropping the car fallback", () => {
    const subtitle = expenseDisplaySubtitle(
      {
        car: null,
        category: ExpenseCategory.FUEL,
        note: null,
        payer: "   ",
        tag: null,
      },
      "2026-07-02",
      t,
      "No car",
    );

    assert.equal(subtitle, "2026-07-02 · No car");
  });
});
