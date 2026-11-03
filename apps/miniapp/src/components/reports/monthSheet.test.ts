import { ExpenseCategory, PaymentMethod, PaymentType } from "@taxi/shared";
import { describe, expect, it } from "vitest";
import type { Expense, Payment } from "../../types";
import { sumMonthSheet } from "./monthSheet";

function payment(partial: Partial<Payment> & Pick<Payment, "amount" | "method">): Payment {
  return {
    id: "p",
    driverId: null,
    carId: null,
    discountAmount: 0,
    date: "2026-09-15",
    type: PaymentType.RENT,
    note: null,
    receivedByPartner: false,
    partnerSettled: false,
    ...partial,
  };
}

function expense(partial: Partial<Expense> & Pick<Expense, "amount">): Expense {
  return {
    id: "e",
    carId: null,
    category: ExpenseCategory.OTHER,
    date: "2026-09-15",
    note: null,
    tag: null,
    paidByPartner: false,
    partnerSettled: false,
    paidByFather: false,
    ...partial,
  };
}

describe("sumMonthSheet", () => {
  it("matches the September settlement sheet", () => {
    const sheet = sumMonthSheet(
      [
        payment({ amount: 3035, method: PaymentMethod.CASH }),
        payment({ amount: 6950, method: PaymentMethod.CASH, receivedByPartner: true }),
        payment({ amount: 13664.05, method: PaymentMethod.BANK }),
      ],
      [
        expense({ amount: 7478.64, paidByPartner: true }),
        expense({ amount: 6775.16 }),
      ],
      "2026-09",
    );
    expect(sheet.incomeSum).toBe(23649.05);
    expect(sheet.expenseSum).toBe(14253.8);
    expect(sheet.partnerNet).toBe(-528.64);
    expect(sheet.net).toBe(9395.25);
  });

  it("shows taxes apart from my expenses and still subtracts them", () => {
    const sheet = sumMonthSheet(
      [payment({ amount: 100, method: PaymentMethod.CASH, date: "2026-09-01" })],
      [
        expense({ amount: 40 }),
        expense({ amount: 50, category: ExpenseCategory.TAX }),
        expense({ amount: 10, category: ExpenseCategory.TAX, paidByPartner: true }),
      ],
      "2026-09",
    );
    expect(sheet.expenseMine).toBe(40);
    expect(sheet.expensePartner).toBe(0);
    expect(sheet.tax).toBe(60);
    expect(sheet.expenseSum).toBe(100);
    expect(sheet.net).toBe(0);
  });

  it("leaves car purchases out until included", () => {
    const rows = [expense({ amount: 20000, category: ExpenseCategory.CAR_PURCHASE, note: "Purchase of OP8645U" })];
    const hidden = sumMonthSheet([], rows, "2026-09");
    const shown = sumMonthSheet([], rows, "2026-09", true);
    expect(hidden.expenseMine).toBe(0);
    expect(shown.expenseMine).toBe(20000);
    expect(shown.net).toBe(-20000);
  });
});
