import assert from "node:assert/strict";
import test from "node:test";
import { ExpenseCategory, PaymentMethod, PaymentType } from "@taxi/shared";
import type { Expense, Payment } from "../../types";
import {
  buildPartnerActivitySummary,
  expenseHasPartnerMarker,
  paymentHasPartnerMarker,
} from "./partnerMonthActivityModel";

function makePayment(overrides: Partial<Payment>): Payment {
  return {
    id: "payment-id",
    driverId: null,
    carId: null,
    amount: 0,
    discountAmount: 0,
    date: "2026-06-01",
    method: PaymentMethod.CASH,
    type: PaymentType.RENT,
    note: null,
    receivedByPartner: false,
    partnerSettled: false,
    ...overrides,
  };
}

function makeExpense(overrides: Partial<Expense>): Expense {
  return {
    id: "expense-id",
    carId: null,
    category: ExpenseCategory.REPAIR,
    amount: 0,
    date: "2026-06-01",
    note: null,
    tag: null,
    paidByPartner: false,
    partnerSettled: false,
    ...overrides,
  };
}

test("buildPartnerActivitySummary includes partner markers from rendered income payments and expenses", () => {
  const summary = buildPartnerActivitySummary({
    selectedMonths: new Set(["2026-07", "2026-06"]),
    payments: [
      makePayment({
        id: "older-income",
        amount: 25,
        date: "2026-06-03",
        type: PaymentType.FINE,
      }),
      makePayment({
        id: "partner-income",
        amount: 100.115,
        date: "2026-06-18",
        receivedByPartner: true,
      }),
      makePayment({
        id: "deposit-not-activity-income",
        amount: 999,
        date: "2026-07-03",
        type: PaymentType.DEPOSIT,
        receivedByPartner: true,
      }),
    ],
    expenses: [
      makeExpense({
        id: "regular-expense",
        amount: 10.114,
        date: "2026-06-20",
      }),
      makeExpense({
        id: "partner-expense",
        amount: 40,
        date: "2026-07-02",
        paidByPartner: true,
      }),
    ],
  });

  assert.equal(summary.hasPartnerMarkers, true);
  assert.deepEqual(
    summary.months.map((month) => month.monthKey),
    ["2026-06", "2026-07"],
  );
  assert.deepEqual(
    summary.months[0]?.payments.map((payment) => payment.id),
    ["partner-income", "older-income"],
  );
  assert.deepEqual(summary.months[1]?.payments, []);
  assert.equal(summary.months[0]?.incomeTotal, 125.12);
  assert.equal(summary.months[0]?.expenseTotal, 10.11);
  assert.equal(summary.grandIncome, 125.12);
  assert.equal(summary.grandExpenses, 50.11);
});

test("buildPartnerActivitySummary ignores partner flags outside rendered selected-month activity", () => {
  const summary = buildPartnerActivitySummary({
    selectedMonths: new Set(["2026-07"]),
    payments: [
      makePayment({
        id: "deposit-with-partner-flag",
        date: "2026-07-08",
        type: PaymentType.DEPOSIT,
        receivedByPartner: true,
      }),
      makePayment({
        id: "unselected-income-with-partner-flag",
        date: "2026-06-08",
        receivedByPartner: true,
      }),
    ],
    expenses: [
      makeExpense({
        id: "unselected-expense-with-partner-flag",
        date: "2026-06-09",
        paidByPartner: true,
      }),
      makeExpense({
        id: "selected-regular-expense",
        date: "2026-07-09",
        amount: 15,
      }),
    ],
  });

  assert.equal(summary.hasPartnerMarkers, false);
  assert.deepEqual(summary.months[0]?.payments, []);
  assert.deepEqual(
    summary.months[0]?.expenses.map((expense) => expense.id),
    ["selected-regular-expense"],
  );
});

test("partner marker predicates mirror the row marker fields", () => {
  assert.equal(paymentHasPartnerMarker(makePayment({ receivedByPartner: true })), true);
  assert.equal(paymentHasPartnerMarker(makePayment({ receivedByPartner: false })), false);
  assert.equal(expenseHasPartnerMarker(makeExpense({ paidByPartner: true })), true);
  assert.equal(expenseHasPartnerMarker(makeExpense({ paidByPartner: false })), false);
});
