import { ExpenseCategory, PaymentMethod, PaymentType } from "@taxi/shared";
import type { Expense, Payment } from "../../types";
import { isIncomePayment } from "./partnerSettlementFormat";

export type FatherTotals = {
  incomeCash: number;
  incomeBank: number;
  incomeSum: number;
  expensePartner: number;
  expenseMine: number;
  expenseSum: number;
};

export function emptyFatherTotals(): FatherTotals {
  return {
    incomeCash: 0,
    incomeBank: 0,
    incomeSum: 0,
    expensePartner: 0,
    expenseMine: 0,
    expenseSum: 0,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function inInclusiveRange(dateStr: string, from: string, to: string): boolean {
  const d = dateStr.slice(0, 10);
  return d >= from.slice(0, 10) && d <= to.slice(0, 10);
}

/** Toggle a car in the shared Max+Oleh selection. */
export function toggleFatherCar(carId: string, selected: string[]): string[] {
  return selected.includes(carId)
    ? selected.filter((id) => id !== carId)
    : [...selected, carId];
}

/** YYYY-MM keys that have income or expense activity in [from, to]. */
export function fatherMonthKeysInRange(
  payments: Payment[],
  expenses: Expense[],
  from: string,
  to: string,
): string[] {
  const keys = new Set<string>();
  for (const p of payments) {
    if (!inInclusiveRange(p.date, from, to)) continue;
    if (!isIncomePayment(p.type as PaymentType)) continue;
    keys.add(p.date.slice(0, 7));
  }
  for (const e of expenses) {
    if (!inInclusiveRange(e.date, from, to)) continue;
    if (e.category === ExpenseCategory.TAX) continue;
    keys.add(e.date.slice(0, 7));
  }
  return [...keys].sort();
}

/**
 * One combined total for all selected cars in the selected months.
 * Income = rent + fines; expenses exclude tax; partner vs mine by paidByPartner.
 */
export function sumFatherSelectedCars(
  payments: Payment[],
  expenses: Expense[],
  carIds: ReadonlySet<string>,
  selectedMonths: ReadonlySet<string>,
): FatherTotals {
  const out = emptyFatherTotals();
  if (carIds.size === 0 || selectedMonths.size === 0) return out;

  for (const p of payments) {
    if (!p.carId || !carIds.has(p.carId)) continue;
    if (!selectedMonths.has(p.date.slice(0, 7))) continue;
    if (!isIncomePayment(p.type as PaymentType)) continue;
    if (p.method === PaymentMethod.CASH) out.incomeCash += p.amount;
    else out.incomeBank += p.amount;
  }

  for (const e of expenses) {
    if (!e.carId || !carIds.has(e.carId)) continue;
    if (!selectedMonths.has(e.date.slice(0, 7))) continue;
    if (e.category === ExpenseCategory.TAX) continue;
    if (e.paidByPartner) out.expensePartner += e.amount;
    else out.expenseMine += e.amount;
  }

  out.incomeCash = round2(out.incomeCash);
  out.incomeBank = round2(out.incomeBank);
  out.incomeSum = round2(out.incomeCash + out.incomeBank);
  out.expensePartner = round2(out.expensePartner);
  out.expenseMine = round2(out.expenseMine);
  out.expenseSum = round2(out.expensePartner + out.expenseMine);
  return out;
}
