import { describe, expect, it } from "vitest";
import { ExpenseCategory, PaymentMethod, PaymentType } from "@taxi/shared";
import type { Expense, Payment } from "../../types";
import {
  assignFatherCar,
  sumFatherPersonTotals,
  sumFatherTotals,
} from "./fatherReport";

function payment(partial: Partial<Payment> & Pick<Payment, "id" | "amount" | "date" | "method" | "type">): Payment {
  return {
    driverId: null,
    carId: partial.carId ?? "car-1",
    discountAmount: 0,
    note: null,
    receivedByPartner: false,
    partnerSettled: false,
    ...partial,
  };
}

function expense(partial: Partial<Expense> & Pick<Expense, "id" | "amount" | "date">): Expense {
  return {
    carId: partial.carId ?? "car-1",
    category: ExpenseCategory.OTHER,
    note: null,
    tag: null,
    paidByPartner: false,
    partnerSettled: false,
    paidByFather: false,
    ...partial,
  };
}

describe("sumFatherPersonTotals", () => {
  it("splits income cash/bank and expenses partner/mine for selected cars", () => {
    const payments = [
      payment({
        id: "1",
        carId: "a",
        amount: 100,
        date: "2026-07-10",
        method: PaymentMethod.CASH,
        type: PaymentType.RENT,
      }),
      payment({
        id: "2",
        carId: "a",
        amount: 200,
        date: "2026-07-11",
        method: PaymentMethod.BANK,
        type: PaymentType.FINE,
      }),
      payment({
        id: "3",
        carId: "b",
        amount: 50,
        date: "2026-07-12",
        method: PaymentMethod.CASH,
        type: PaymentType.RENT,
      }),
      payment({
        id: "4",
        carId: "a",
        amount: 999,
        date: "2026-07-13",
        method: PaymentMethod.CASH,
        type: PaymentType.DEPOSIT,
      }),
    ];
    const expenses = [
      expense({ id: "e1", carId: "a", amount: 40, date: "2026-07-10", paidByPartner: true }),
      expense({ id: "e2", carId: "a", amount: 15, date: "2026-07-11", paidByPartner: false }),
      expense({ id: "e3", carId: "a", amount: 80, date: "2026-07-11", category: ExpenseCategory.TAX }),
    ];

    const totals = sumFatherPersonTotals(
      payments,
      expenses,
      new Set(["a"]),
      "2026-07-01",
      "2026-07-31",
    );

    expect(totals).toEqual({
      incomeCash: 100,
      incomeBank: 200,
      incomeSum: 300,
      expensePartner: 40,
      expenseMine: 15,
      expenseSum: 55,
    });
  });

  it("returns zeros when no cars selected", () => {
    expect(
      sumFatherPersonTotals(
        [payment({ id: "1", amount: 10, date: "2026-07-01", method: PaymentMethod.CASH, type: PaymentType.RENT })],
        [],
        new Set(),
        "2026-07-01",
        "2026-07-31",
      ),
    ).toEqual({
      incomeCash: 0,
      incomeBank: 0,
      incomeSum: 0,
      expensePartner: 0,
      expenseMine: 0,
      expenseSum: 0,
    });
  });
});

describe("sumFatherTotals", () => {
  it("adds two person totals", () => {
    const a = sumFatherPersonTotals(
      [payment({ id: "1", carId: "a", amount: 10, date: "2026-07-01", method: PaymentMethod.CASH, type: PaymentType.RENT })],
      [],
      new Set(["a"]),
      "2026-07-01",
      "2026-07-31",
    );
    const b = sumFatherPersonTotals(
      [payment({ id: "2", carId: "b", amount: 20, date: "2026-07-01", method: PaymentMethod.BANK, type: PaymentType.RENT })],
      [],
      new Set(["b"]),
      "2026-07-01",
      "2026-07-31",
    );
    expect(sumFatherTotals(a, b).incomeSum).toBe(30);
  });
});

describe("assignFatherCar", () => {
  it("moves a car from Oleh to Max", () => {
    expect(assignFatherCar("max", "c1", [], ["c1"])).toEqual({
      maxCars: ["c1"],
      olehCars: [],
    });
  });

  it("toggles off when already assigned to the same person", () => {
    expect(assignFatherCar("oleh", "c1", [], ["c1"])).toEqual({
      maxCars: [],
      olehCars: [],
    });
  });
});
