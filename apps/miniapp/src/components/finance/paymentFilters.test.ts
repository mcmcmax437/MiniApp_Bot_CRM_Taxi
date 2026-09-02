import { afterEach, describe, expect, it, vi } from "vitest";
import { PaymentBank, PaymentMethod, PaymentType } from "@taxi/shared";
import type { Payment } from "../../types";
import {
  filterPaymentsByFinanceFilters,
  filterPaymentsBySearch,
} from "./paymentFilters";

function ids(payments: Payment[]): string[] {
  return payments.map((payment) => payment.id);
}

function payment(overrides: Partial<Payment>): Payment {
  return {
    id: "payment",
    driverId: "driver-1",
    carId: "car-1",
    amount: 100,
    discountAmount: 0,
    date: "2026-09-05",
    method: PaymentMethod.BANK,
    bank: PaymentBank.PKO,
    type: PaymentType.RENT,
    note: null,
    receivedByPartner: false,
    partnerSettled: false,
    ...overrides,
  };
}

describe("payment finance filters", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("filters payments by who received them", () => {
    const payments = [
      payment({ id: "mine-bank", receivedByPartner: false }),
      payment({ id: "partner-bank", receivedByPartner: true }),
      payment({
        id: "mine-cash",
        method: PaymentMethod.CASH,
        bank: PaymentBank.NONE,
        receivedByPartner: false,
      }),
    ];

    expect(
      ids(
        filterPaymentsByFinanceFilters(payments, {
          period: "all",
          receiverFilters: ["MINE"],
        }),
      ),
    ).toEqual(["mine-bank", "mine-cash"]);
    expect(
      ids(
        filterPaymentsByFinanceFilters(payments, {
          period: "all",
          receiverFilters: ["PARTNER"],
        }),
      ),
    ).toEqual(["partner-bank"]);
    expect(
      ids(
        filterPaymentsByFinanceFilters(payments, {
          period: "all",
          receiverFilters: ["MINE", "PARTNER"],
        }),
      ),
    ).toEqual(["mine-bank", "partner-bank", "mine-cash"]);
  });

  it("applies receiver filters to current-month payment stats with other filters", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00Z"));

    const payments = [
      payment({
        id: "matching-partner-transfer",
        carId: "car-a",
        method: PaymentMethod.BANK,
        bank: PaymentBank.PKO,
        date: "2026-09-05",
        receivedByPartner: true,
      }),
      payment({
        id: "mine-transfer",
        carId: "car-a",
        method: PaymentMethod.BANK,
        bank: PaymentBank.PKO,
        date: "2026-09-06",
        receivedByPartner: false,
      }),
      payment({
        id: "old-partner-transfer",
        carId: "car-a",
        method: PaymentMethod.BANK,
        bank: PaymentBank.PKO,
        date: "2026-08-31",
        receivedByPartner: true,
      }),
      payment({
        id: "partner-cash",
        carId: "car-a",
        method: PaymentMethod.CASH,
        bank: PaymentBank.NONE,
        date: "2026-09-07",
        receivedByPartner: true,
      }),
    ];

    expect(
      ids(
        filterPaymentsByFinanceFilters(payments, {
          period: "month",
          receiverFilters: ["PARTNER"],
          methodFilters: [PaymentMethod.BANK],
          bankFilters: [PaymentBank.PKO],
          carFilters: ["car-a"],
        }),
      ),
    ).toEqual(["matching-partner-transfer"]);
  });
});

describe("payment search filters", () => {
  const receiverLabels = {
    receivedByPartner: "Received by partner",
    receivedByMe: "Received by me",
  };

  it("matches localized receiver labels", () => {
    const payments = [
      payment({ id: "mine", receivedByPartner: false }),
      payment({ id: "partner", receivedByPartner: true }),
    ];

    expect(ids(filterPaymentsBySearch(payments, "received by me", receiverLabels))).toEqual([
      "mine",
    ]);
    expect(ids(filterPaymentsBySearch(payments, " PARTNER ", receiverLabels))).toEqual([
      "partner",
    ]);
  });
});
