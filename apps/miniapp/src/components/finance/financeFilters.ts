import {
  PaymentBank,
  type PaymentBank as PaymentBankValue,
  type PaymentMethod,
} from "@taxi/shared";

export type FinancePayerFilter = "PARTNER" | "MINE";

/** Toggle a value in a multi-select list (empty list = no filter / all). */
export function toggleFilterValue<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

export function paymentMatchesFinanceFilters(
  payment: { method: PaymentMethod; bank?: PaymentBankValue | null },
  filters: {
    methods?: readonly PaymentMethod[];
    banks?: readonly PaymentBankValue[];
  },
): boolean {
  const methods = filters.methods ?? [];
  if (methods.length > 0 && !methods.includes(payment.method)) return false;

  const banks = filters.banks ?? [];
  if (banks.length > 0) {
    const bank = payment.bank ?? PaymentBank.NONE;
    if (!banks.includes(bank)) return false;
  }

  return true;
}

export function expenseMatchesPayerFilters(
  expense: { paidByPartner: boolean },
  payerFilters: readonly FinancePayerFilter[],
): boolean {
  if (payerFilters.length === 0) return true;

  const matchPartner = payerFilters.includes("PARTNER") && expense.paidByPartner;
  const matchMine = payerFilters.includes("MINE") && !expense.paidByPartner;
  return matchPartner || matchMine;
}
