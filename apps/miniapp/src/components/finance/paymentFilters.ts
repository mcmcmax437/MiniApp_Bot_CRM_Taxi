import { PaymentBank, PaymentMethod } from "@taxi/shared";
import type { Payment } from "../../types";
import {
  financeInPeriod,
  type FinanceDateRange,
  type FinancePeriod,
} from "./financePeriod";

export type PaymentReceiverFilter = "PARTNER" | "MINE";

export type PaymentFinanceFilters = {
  period: FinancePeriod;
  dateRange?: FinanceDateRange | null;
  receiverFilters?: PaymentReceiverFilter[];
  methodFilters?: PaymentMethod[];
  bankFilters?: PaymentBank[];
  carFilters?: string[];
};

export type PaymentReceiverSearchLabels = {
  receivedByPartner: string;
  receivedByMe: string;
};

export function filterPaymentsByFinanceFilters(
  payments: Payment[],
  filters: PaymentFinanceFilters,
): Payment[] {
  return payments.filter((payment) => {
    if (!financeInPeriod(payment.date, filters.period, filters.dateRange)) return false;

    const receiverFilters = filters.receiverFilters ?? [];
    if (receiverFilters.length > 0) {
      const matchPartner = receiverFilters.includes("PARTNER") && payment.receivedByPartner;
      const matchMine = receiverFilters.includes("MINE") && !payment.receivedByPartner;
      if (!matchPartner && !matchMine) return false;
    }

    const methodFilters = filters.methodFilters ?? [];
    if (methodFilters.length > 0 && !methodFilters.includes(payment.method)) return false;

    const bankFilters = filters.bankFilters ?? [];
    if (bankFilters.length > 0) {
      const bank = payment.bank ?? PaymentBank.NONE;
      if (!bankFilters.includes(bank)) return false;
    }

    const carFilters = filters.carFilters ?? [];
    if (carFilters.length > 0) {
      const carId = payment.carId ?? "";
      if (!carFilters.includes(carId)) return false;
    }

    return true;
  });
}

export function filterPaymentsBySearch(
  payments: Payment[],
  search: string,
  labels: PaymentReceiverSearchLabels,
): Payment[] {
  const query = search.trim().toLowerCase();
  if (!query) return payments;

  return payments.filter((payment) => {
    const bank =
      payment.method === PaymentMethod.BANK && payment.bank && payment.bank !== PaymentBank.NONE
        ? payment.bank
        : "";
    const receiver = payment.receivedByPartner
      ? labels.receivedByPartner
      : labels.receivedByMe;
    const haystack = [
      payment.driver?.fullName ?? "",
      payment.car?.plate ?? "",
      payment.note ?? "",
      String(payment.amount),
      bank,
      receiver,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}
