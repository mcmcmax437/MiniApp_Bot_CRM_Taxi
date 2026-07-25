import { describe, expect, it } from "vitest";
import { PaymentType } from "@taxi/shared";
import {
  isIncomePayment,
  monthKeyFromIso,
  partnerExpenseDescription,
  partnerPaymentDescription,
} from "./partnerSettlementFormat.js";

describe("isIncomePayment", () => {
  it("counts rent and fines as income", () => {
    expect(isIncomePayment(PaymentType.RENT)).toBe(true);
    expect(isIncomePayment(PaymentType.FINE)).toBe(true);
  });

  it("excludes deposits, refunds, and discounts from income", () => {
    expect(isIncomePayment(PaymentType.DEPOSIT)).toBe(false);
    expect(isIncomePayment(PaymentType.REFUND)).toBe(false);
    expect(isIncomePayment(PaymentType.DISCOUNT)).toBe(false);
  });
});

describe("monthKeyFromIso", () => {
  it("returns YYYY-MM", () => {
    expect(monthKeyFromIso("2026-07-13T12:00:00.000Z")).toBe("2026-07");
  });
});

describe("partnerPaymentDescription", () => {
  it("joins driver and note", () => {
    expect(
      partnerPaymentDescription({
        driver: { id: "1", fullName: "Ivan" },
        note: "week 1",
      }),
    ).toBe("Ivan — week 1");
  });

  it("falls back to em dash", () => {
    expect(partnerPaymentDescription({ driver: undefined, note: null })).toBe("—");
  });
});

describe("partnerExpenseDescription", () => {
  it("joins plate and note", () => {
    expect(
      partnerExpenseDescription({
        car: { id: "1", plate: "PY5132F" },
        note: "fuel",
      }),
    ).toBe("PY5132F · fuel");
  });
});
