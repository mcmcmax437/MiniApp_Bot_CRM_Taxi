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

  it("ignores non-income payments, tax expenses, missing cars, and unselected scope", () => {
    const payments = [
      payment({
        id: "cash-rent",
        carId: "a",
        amount: 100.115,
        date: "2026-07-10",
        method: PaymentMethod.CASH,
        type: PaymentType.RENT,
      }),
      payment({
        id: "bank-fine",
        carId: "b",
        amount: 50.225,
        date: "2026-07-11T09:30:00.000Z",
        method: PaymentMethod.BANK,
        type: PaymentType.FINE,
      }),
      payment({
        id: "deposit",
        carId: "a",
        amount: 999,
        date: "2026-07-12",
        method: PaymentMethod.CASH,
        type: PaymentType.DEPOSIT,
      }),
      payment({
        id: "refund",
        carId: "a",
        amount: 888,
        date: "2026-07-13",
        method: PaymentMethod.BANK,
        type: PaymentType.REFUND,
      }),
      payment({
        id: "discount",
        carId: "a",
        amount: 777,
        date: "2026-07-14",
        method: PaymentMethod.CASH,
        type: PaymentType.DISCOUNT,
      }),
      payment({
        id: "wrong-car",
        carId: "c",
        amount: 666,
        date: "2026-07-15",
        method: PaymentMethod.CASH,
        type: PaymentType.RENT,
      }),
      payment({
        id: "wrong-month",
        carId: "a",
        amount: 555,
        date: "2026-08-01",
        method: PaymentMethod.CASH,
        type: PaymentType.RENT,
      }),
      payment({
        id: "missing-car",
        carId: null,
        amount: 444,
        date: "2026-07-16",
        method: PaymentMethod.CASH,
        type: PaymentType.RENT,
      }),
    ];
    const expenses = [
      expense({ id: "partner", carId: "a", amount: 10.115, date: "2026-07-10", paidByPartner: true }),
      expense({ id: "mine", carId: "b", amount: 20.225, date: "2026-07-11", paidByPartner: false }),
      expense({
        id: "tax",
        carId: "a",
        amount: 999,
        date: "2026-07-12",
        category: ExpenseCategory.TAX,
        paidByPartner: true,
      }),
      expense({ id: "expense-wrong-car", carId: "c", amount: 888, date: "2026-07-13" }),
      expense({ id: "expense-wrong-month", carId: "a", amount: 777, date: "2026-08-01" }),
      expense({ id: "expense-missing-car", carId: null, amount: 666, date: "2026-07-14" }),
    ];

    const totals = sumFatherSelectedCars(
      payments,
      expenses,
      new Set(["a", "b"]),
      new Set(["2026-07"]),
    );

    expect(totals).toEqual({
      incomeCash: 100.12,
      incomeBank: 50.23,
      incomeSum: 150.35,
      expensePartner: 10.12,
      expenseMine: 20.23,
      expenseSum: 30.35,
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

  it("uses inclusive date boundaries and excludes tax or non-income-only activity", () => {
    expect(
      fatherMonthKeysInRange(
        [
          payment({
            id: "start-boundary",
            amount: 1,
            date: "2026-01-01T23:59:59.000Z",
            method: PaymentMethod.CASH,
            type: PaymentType.RENT,
          }),
          payment({
            id: "end-boundary",
            amount: 1,
            date: "2026-12-31",
            method: PaymentMethod.BANK,
            type: PaymentType.FINE,
          }),
          payment({
            id: "before-range",
            amount: 1,
            date: "2025-12-31",
            method: PaymentMethod.CASH,
            type: PaymentType.RENT,
          }),
          payment({
            id: "after-range",
            amount: 1,
            date: "2027-01-01",
            method: PaymentMethod.CASH,
            type: PaymentType.RENT,
          }),
          payment({
            id: "deposit-only",
            amount: 1,
            date: "2026-03-01",
            method: PaymentMethod.CASH,
            type: PaymentType.DEPOSIT,
          }),
        ],
        [
          expense({ id: "expense-month", amount: 1, date: "2026-04-15" }),
          expense({ id: "tax-only", amount: 1, date: "2026-05-15", category: ExpenseCategory.TAX }),
        ],
        "2026-01-01",
        "2026-12-31",
      ),
    ).toEqual(["2026-01", "2026-04", "2026-12"]);
  });
});

describe("toggleFatherCar", () => {
  it("adds and removes a car id", () => {
    expect(toggleFatherCar("c1", [])).toEqual(["c1"]);
    expect(toggleFatherCar("c1", ["c1", "c2"])).toEqual(["c2"]);
  });
});
