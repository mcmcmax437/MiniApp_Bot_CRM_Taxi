import type { Expense, Payment } from "../../types";
import { isIncomePayment, monthKeyFromIso } from "./partnerSettlementFormat";

export type ActivityMonth = {
  monthKey: string;
  incomeTotal: number;
  expenseTotal: number;
  payments: Payment[];
  expenses: Expense[];
};

export type PartnerActivitySummary = {
  months: ActivityMonth[];
  grandIncome: number;
  grandExpenses: number;
  hasPartnerMarkers: boolean;
};

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function paymentHasPartnerMarker(payment: Pick<Payment, "receivedByPartner">): boolean {
  return payment.receivedByPartner;
}

export function expenseHasPartnerMarker(expense: Pick<Expense, "paidByPartner">): boolean {
  return expense.paidByPartner;
}

export function buildPartnerActivitySummary({
  selectedMonths,
  payments,
  expenses,
}: {
  selectedMonths: Iterable<string>;
  payments?: Payment[] | null;
  expenses?: Expense[] | null;
}): PartnerActivitySummary {
  const sorted = [...selectedMonths].sort();
  let grandIncome = 0;
  let grandExpenses = 0;
  let hasPartnerMarkers = false;

  const months = sorted.map((monthKey) => {
    const monthPayments = (payments ?? [])
      .filter((p) => isIncomePayment(p.type) && monthKeyFromIso(p.date) === monthKey)
      .sort((a, b) => b.date.localeCompare(a.date));
    const monthExpenses = (expenses ?? [])
      .filter((e) => monthKeyFromIso(e.date) === monthKey)
      .sort((a, b) => b.date.localeCompare(a.date));

    if (
      monthPayments.some(paymentHasPartnerMarker) ||
      monthExpenses.some(expenseHasPartnerMarker)
    ) {
      hasPartnerMarkers = true;
    }

    const incomeTotal = round2(monthPayments.reduce((s, p) => s + p.amount, 0));
    const expenseTotal = round2(monthExpenses.reduce((s, e) => s + e.amount, 0));
    grandIncome += incomeTotal;
    grandExpenses += expenseTotal;

    return { monthKey, incomeTotal, expenseTotal, payments: monthPayments, expenses: monthExpenses };
  });

  return {
    months,
    grandIncome: round2(grandIncome),
    grandExpenses: round2(grandExpenses),
    hasPartnerMarkers,
  };
}
