import { ExpenseCategory, PaymentMethod, PaymentType, isCarPurchaseExpense } from "@taxi/shared";
import type { Expense, Payment } from "../../types";
import { isIncomePayment, monthKeyFromIso } from "./partnerSettlementFormat";

export type MonthSheet = {
  monthKey: string;
  cashMine: number;
  cashPartner: number;
  bankIncome: number;
  incomeSum: number;
  expensePartner: number;
  expenseMine: number;
  expenseSum: number;
  /** Partner cash income minus expenses the partner paid. */
  partnerNet: number;
  /** All income minus all expenses. */
  net: number;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function emptyMonthSheet(monthKey: string): MonthSheet {
  return {
    monthKey,
    cashMine: 0,
    cashPartner: 0,
    bankIncome: 0,
    incomeSum: 0,
    expensePartner: 0,
    expenseMine: 0,
    expenseSum: 0,
    partnerNet: 0,
    net: 0,
  };
}

export function monthSheetKeys(
  payments: Payment[],
  expenses: Expense[],
  from: string,
  to: string,
  includeCarPurchases = false,
): string[] {
  const keys = new Set<string>();
  const fromKey = from.slice(0, 7);
  const toKey = to.slice(0, 7);
  for (const p of payments) {
    const key = monthKeyFromIso(p.date);
    if (key < fromKey || key > toKey) continue;
    if (!isIncomePayment(p.type as PaymentType)) continue;
    keys.add(key);
  }
  for (const e of expenses) {
    const key = monthKeyFromIso(e.date);
    if (key < fromKey || key > toKey) continue;
    if (!includeCarPurchases && isCarPurchaseExpense(e)) continue;
    keys.add(key);
  }
  return [...keys].sort();
}

/** One month: cash you received, cash the partner received, bank, and who paid expenses. */
export function sumMonthSheet(
  payments: Payment[],
  expenses: Expense[],
  monthKey: string,
  includeCarPurchases = false,
): MonthSheet {
  const out = emptyMonthSheet(monthKey);

  for (const p of payments) {
    if (monthKeyFromIso(p.date) !== monthKey) continue;
    if (!isIncomePayment(p.type as PaymentType)) continue;
    if (p.method === PaymentMethod.BANK) out.bankIncome += p.amount;
    else if (p.receivedByPartner) out.cashPartner += p.amount;
    else out.cashMine += p.amount;
  }

  for (const e of expenses) {
    if (monthKeyFromIso(e.date) !== monthKey) continue;
    if (!includeCarPurchases && isCarPurchaseExpense(e)) continue;
    if (e.category === ExpenseCategory.TAX || !e.paidByPartner) out.expenseMine += e.amount;
    else out.expensePartner += e.amount;
  }

  out.cashMine = round2(out.cashMine);
  out.cashPartner = round2(out.cashPartner);
  out.bankIncome = round2(out.bankIncome);
  out.incomeSum = round2(out.cashMine + out.cashPartner + out.bankIncome);
  out.expensePartner = round2(out.expensePartner);
  out.expenseMine = round2(out.expenseMine);
  out.expenseSum = round2(out.expensePartner + out.expenseMine);
  out.partnerNet = round2(out.cashPartner - out.expensePartner);
  out.net = round2(out.incomeSum - out.expenseSum);
  return out;
}
