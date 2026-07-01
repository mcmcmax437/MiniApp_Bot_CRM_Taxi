import { strict as assert } from "node:assert";
import test from "node:test";
import { ExpenseCategory, PaymentMethod, PaymentType } from "@taxi/shared";
import type { Expense, Payment } from "../../types";
import {
  buildPartnerActivityModel,
  formatActivityExpenseAmount,
  formatActivityIncomeAmount,
} from "./partnerMonthActivityModel";

function makePayment(overrides: Partial<Payment> & Pick<Payment, "id" | "amount" | "date" | "type">): Payment {
  return {
    driverId: null,
    carId: null,
    method: PaymentMethod.CASH,
    note: null,
    discountAmount: 0,
    receivedByPartner: false,
    partnerSettled: false,
    ...overrides,
  };
}

function makeExpense(overrides: Partial<Expense> & Pick<Expense, "id" | "amount" | "date">): Expense {
  return {
    carId: null,
    category: ExpenseCategory.OTHER,
    note: null,
    tag: null,
    paidByPartner: false,
    partnerSettled: false,
    ...overrides,
  };
}

test("formats partner activity amounts with explicit income and expense signs", () => {
  const formatMoney = (amount: number) => `${amount.toFixed(2)} PLN`;

  assert.equal(formatActivityIncomeAmount(123.4, formatMoney), "+123.40 PLN");
  assert.equal(formatActivityExpenseAmount(123.4, formatMoney), "−123.40 PLN");
  assert.notEqual(formatActivityExpenseAmount(123.4, formatMoney).charAt(0), "-");
});

test("builds partner activity months from only selected income payments and expenses", () => {
  const model = buildPartnerActivityModel({
    selectedMonths: new Set(["2026-02", "2026-01"]),
    payments: [
      makePayment({
        id: "ignored-deposit",
        amount: 500,
        date: "2026-01-12T10:00:00.000Z",
        type: PaymentType.DEPOSIT,
      }),
      makePayment({
        id: "jan-rent",
        amount: 100.1,
        date: "2026-01-15T10:00:00.000Z",
        type: PaymentType.RENT,
      }),
      makePayment({
        id: "jan-fine",
        amount: 20.2,
        date: "2026-01-20T10:00:00.000Z",
        type: PaymentType.FINE,
      }),
      makePayment({
        id: "feb-rent",
        amount: 5.555,
        date: "2026-02-01T10:00:00.000Z",
        type: PaymentType.RENT,
      }),
      makePayment({
        id: "ignored-march",
        amount: 900,
        date: "2026-03-01T10:00:00.000Z",
        type: PaymentType.RENT,
      }),
    ],
    expenses: [
      makeExpense({ id: "jan-old-expense", amount: 1.02, date: "2026-01-01T10:00:00.000Z" }),
      makeExpense({ id: "jan-new-expense", amount: 40.1, date: "2026-01-25T10:00:00.000Z" }),
      makeExpense({ id: "feb-expense", amount: 10.01, date: "2026-02-03T10:00:00.000Z" }),
      makeExpense({ id: "ignored-march-expense", amount: 300, date: "2026-03-03T10:00:00.000Z" }),
    ],
  });

  assert.deepEqual(
    model.months.map((month) => month.monthKey),
    ["2026-01", "2026-02"],
  );
  assert.deepEqual(
    model.months[0].payments.map((payment) => payment.id),
    ["jan-fine", "jan-rent"],
  );
  assert.deepEqual(
    model.months[0].expenses.map((expense) => expense.id),
    ["jan-new-expense", "jan-old-expense"],
  );
  assert.equal(model.months[0].incomeTotal, 120.3);
  assert.equal(model.months[0].expenseTotal, 41.12);
  assert.equal(model.months[1].incomeTotal, 5.56);
  assert.equal(model.months[1].expenseTotal, 10.01);
  assert.equal(model.grandIncome, 125.86);
  assert.equal(model.grandExpenses, 51.13);
});
