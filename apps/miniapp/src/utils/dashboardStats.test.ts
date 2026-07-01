import assert from "node:assert/strict";
import test from "node:test";
import { ExpenseCategory, PaymentMethod, PaymentType } from "@taxi/shared";
import {
  expenseInStatsPeriod,
  filterDashboardExpenses,
  filterDashboardIncomePayments,
  parseStatBreakdownKind,
  parseStatsPeriod,
  paymentInStatsPeriod,
  reportDateRange,
} from "./dashboardStats";
import type { Expense, Payment } from "../types";

type DateConstructorArgs =
  | []
  | [value: string | number | Date]
  | [
      year: number,
      monthIndex: number,
      date?: number,
      hours?: number,
      minutes?: number,
      seconds?: number,
      ms?: number,
    ];

function withFixedNow<T>(isoNow: string, fn: () => T): T {
  const RealDate = Date;
  const fixedTime = new RealDate(isoNow).getTime();

  class FixedDate extends RealDate {
    constructor(...args: DateConstructorArgs) {
      if (args.length === 0) {
        super(fixedTime);
        return;
      }
      if (args.length === 1) {
        super(args[0]);
        return;
      }
      super(args[0], args[1], args[2] ?? 1, args[3] ?? 0, args[4] ?? 0, args[5] ?? 0, args[6] ?? 0);
    }

    static now() {
      return fixedTime;
    }
  }

  globalThis.Date = FixedDate as DateConstructor;
  try {
    return fn();
  } finally {
    globalThis.Date = RealDate;
  }
}

function payment(input: Partial<Payment> & Pick<Payment, "id" | "date" | "type">): Payment {
  return {
    amount: 100,
    carId: "car-a",
    discountAmount: 0,
    driverId: null,
    method: PaymentMethod.BANK,
    note: null,
    partnerSettled: false,
    receivedByPartner: false,
    ...input,
  };
}

function expense(input: Partial<Expense> & Pick<Expense, "id" | "date">): Expense {
  return {
    amount: 100,
    carId: "car-a",
    category: ExpenseCategory.OTHER,
    note: null,
    paidByPartner: false,
    partnerSettled: false,
    tag: null,
    ...input,
  };
}

test("reportDateRange returns the same ranges used by dashboard report links", () => {
  withFixedNow("2026-07-15T12:00:00.000Z", () => {
    assert.deepEqual(reportDateRange("month"), { from: "2026-07-01", to: "2026-07-15" });
    assert.deepEqual(reportDateRange("previous"), { from: "2026-06-01", to: "2026-06-30" });
    assert.deepEqual(reportDateRange("all"), { from: "2000-01-01", to: "2026-07-15" });
  });
});

test("month stats keep income to report-to-date but expenses to the calendar month", () => {
  withFixedNow("2026-07-15T12:00:00.000Z", () => {
    assert.equal(paymentInStatsPeriod("2026-07-14", "month"), true);
    assert.equal(paymentInStatsPeriod("2026-07-20", "month"), false);
    assert.equal(expenseInStatsPeriod("2026-07-20", "month"), true);
    assert.equal(expenseInStatsPeriod("2026-06-30", "previous"), true);
    assert.equal(expenseInStatsPeriod("2026-07-01", "previous"), false);
  });
});

test("filterDashboardIncomePayments includes rent and fines only for the selected car and period", () => {
  withFixedNow("2026-07-15T12:00:00.000Z", () => {
    const rows = [
      payment({ id: "rent-current", date: "2026-07-03", type: PaymentType.RENT }),
      payment({ id: "fine-current", date: "2026-07-04", type: PaymentType.FINE }),
      payment({ id: "deposit-current", date: "2026-07-05", type: PaymentType.DEPOSIT }),
      payment({ id: "rent-other-car", carId: "car-b", date: "2026-07-06", type: PaymentType.RENT }),
      payment({ id: "rent-future", date: "2026-07-20", type: PaymentType.RENT }),
    ];

    assert.deepEqual(
      filterDashboardIncomePayments(rows, "month", "car-a").map((row) => row.id),
      ["rent-current", "fine-current"],
    );
  });
});

test("filterDashboardExpenses uses selected car and full calendar month for current expenses", () => {
  withFixedNow("2026-07-15T12:00:00.000Z", () => {
    const rows = [
      expense({ id: "expense-current", date: "2026-07-03" }),
      expense({ id: "expense-future-current-month", date: "2026-07-20" }),
      expense({ id: "expense-previous", date: "2026-06-30" }),
      expense({ id: "expense-other-car", carId: "car-b", date: "2026-07-04" }),
    ];

    assert.deepEqual(
      filterDashboardExpenses(rows, "month", "car-a").map((row) => row.id),
      ["expense-current", "expense-future-current-month"],
    );
  });
});

test("stats breakdown query parsers reject unsupported values safely", () => {
  assert.equal(parseStatBreakdownKind("income"), "income");
  assert.equal(parseStatBreakdownKind("expenses"), "expenses");
  assert.equal(parseStatBreakdownKind("profit"), null);

  assert.equal(parseStatsPeriod("month"), "month");
  assert.equal(parseStatsPeriod("previous"), "previous");
  assert.equal(parseStatsPeriod("all"), "all");
  assert.equal(parseStatsPeriod("bad-period"), "all");
  assert.equal(parseStatsPeriod(null), "all");
});
