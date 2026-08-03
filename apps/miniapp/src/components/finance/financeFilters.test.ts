import { describe, expect, it } from "vitest";
import { PaymentBank, PaymentMethod } from "@taxi/shared";
import {
  expenseMatchesPayerFilters,
  paymentMatchesFinanceFilters,
  toggleFilterValue,
} from "./financeFilters";

describe("toggleFilterValue", () => {
  it("adds and removes values without mutating the current selection", () => {
    const selected = [PaymentMethod.CASH];

    expect(toggleFilterValue(selected, PaymentMethod.BANK)).toEqual([
      PaymentMethod.CASH,
      PaymentMethod.BANK,
    ]);
    expect(selected).toEqual([PaymentMethod.CASH]);
    expect(toggleFilterValue([PaymentMethod.CASH, PaymentMethod.BANK], PaymentMethod.CASH)).toEqual([
      PaymentMethod.BANK,
    ]);
  });
});

describe("paymentMatchesFinanceFilters", () => {
  const cashPayment = { method: PaymentMethod.CASH, bank: PaymentBank.NONE };
  const pkoPayment = { method: PaymentMethod.BANK, bank: PaymentBank.PKO };
  const caPayment = { method: PaymentMethod.BANK, bank: PaymentBank.CA };

  it("matches every payment when no method or bank filters are selected", () => {
    expect(paymentMatchesFinanceFilters(cashPayment, {})).toBe(true);
    expect(paymentMatchesFinanceFilters(pkoPayment, { methods: [], banks: [] })).toBe(true);
  });

  it("treats selections inside each group as OR, then combines method and bank groups with AND", () => {
    const filters = {
      methods: [PaymentMethod.BANK],
      banks: [PaymentBank.PKO, PaymentBank.CA],
    };

    expect(paymentMatchesFinanceFilters(pkoPayment, filters)).toBe(true);
    expect(paymentMatchesFinanceFilters(caPayment, filters)).toBe(true);
    expect(paymentMatchesFinanceFilters(cashPayment, filters)).toBe(false);
  });

  it("treats a missing payment bank as NONE for legacy and cash rows", () => {
    expect(
      paymentMatchesFinanceFilters(
        { method: PaymentMethod.CASH },
        { banks: [PaymentBank.NONE] },
      ),
    ).toBe(true);
    expect(
      paymentMatchesFinanceFilters(
        { method: PaymentMethod.CASH },
        { banks: [PaymentBank.PKO] },
      ),
    ).toBe(false);
  });
});

describe("expenseMatchesPayerFilters", () => {
  const partnerExpense = { paidByPartner: true };
  const ownerExpense = { paidByPartner: false };

  it("matches every expense when no payer filters are selected", () => {
    expect(expenseMatchesPayerFilters(partnerExpense, [])).toBe(true);
    expect(expenseMatchesPayerFilters(ownerExpense, [])).toBe(true);
  });

  it("matches partner-paid and owner-paid expenses independently", () => {
    expect(expenseMatchesPayerFilters(partnerExpense, ["PARTNER"])).toBe(true);
    expect(expenseMatchesPayerFilters(ownerExpense, ["PARTNER"])).toBe(false);
    expect(expenseMatchesPayerFilters(partnerExpense, ["MINE"])).toBe(false);
    expect(expenseMatchesPayerFilters(ownerExpense, ["MINE"])).toBe(true);
  });

  it("matches both payer classes when both filters are selected", () => {
    expect(expenseMatchesPayerFilters(partnerExpense, ["PARTNER", "MINE"])).toBe(true);
    expect(expenseMatchesPayerFilters(ownerExpense, ["PARTNER", "MINE"])).toBe(true);
  });
});
