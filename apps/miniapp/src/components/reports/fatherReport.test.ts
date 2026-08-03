import { describe, expect, it } from "vitest";
import { ExpenseCategory, PaymentMethod, PaymentType } from "@taxi/shared";
import type { Expense, Payment } from "../../types";
import {
  fatherMonthKeysInRange,
  sumFatherSelectedCars,
  toggleFatherCar,
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

describe("sumFatherSelectedCars", () => {
  it("returns one combined sum for selected cars and months", () => {
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
        carId: "b",
        amount: 200,
        date: "2026-07-11",
        method: PaymentMethod.BANK,
        type: PaymentType.FINE,
      }),
      payment({
        id: "3",
        carId: "a",
        amount: 50,
        date: "2026-06-12",
        method: PaymentMethod.CASH,
        type: PaymentType.RENT,
      }),
    ];
    const expenses = [
      expense({ id: "e1", carId: "a", amount: 40, date: "2026-07-10", paidByPartner: true }),
      expense({ id: "e2", carId: "b", amount: 15, date: "2026-07-11", paidByPartner: false }),
    ];

    const totals = sumFatherSelectedCars(
      payments,
      expenses,
      new Set(["a", "b"]),
      new Set(["2026-07"]),
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

  it("returns zeros when no months selected", () => {
    expect(
      sumFatherSelectedCars(
        [payment({ id: "1", amount: 10, date: "2026-07-01", method: PaymentMethod.CASH, type: PaymentType.RENT })],
        [],
        new Set(["car-1"]),
        new Set(),
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

describe("fatherMonthKeysInRange", () => {
  it("collects YYYY-MM keys with activity", () => {
    expect(
      fatherMonthKeysInRange(
        [
          payment({ id: "1", amount: 1, date: "2026-07-01", method: PaymentMethod.CASH, type: PaymentType.RENT }),
          payment({ id: "2", amount: 1, date: "2026-05-01", method: PaymentMethod.CASH, type: PaymentType.RENT }),
        ],
        [expense({ id: "e1", amount: 1, date: "2026-07-15" })],
        "2026-01-01",
        "2026-12-31",
      ),
    ).toEqual(["2026-05", "2026-07"]);
  });
});

describe("toggleFatherCar", () => {
  it("adds and removes a car id", () => {
    expect(toggleFatherCar("c1", [])).toEqual(["c1"]);
    expect(toggleFatherCar("c1", ["c1", "c2"])).toEqual(["c2"]);
  });
});
