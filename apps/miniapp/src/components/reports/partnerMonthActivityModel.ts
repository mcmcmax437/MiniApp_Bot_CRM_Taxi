import type { Expense, Payment } from "../../types";
import { isIncomePayment, monthKeyFromIso } from "./partnerSettlementFormat";

export type ActivityMonth = {
  monthKey: string;
  incomeTotal: number;
  expenseTotal: number;
  payments: Payment[];
  expenses: Expense[];
};

export type PartnerActivityModel = {
  months: ActivityMonth[];
  grandIncome: number;
  grandExpenses: number;
};

type PartnerActivityInput = {
  selectedMonths: Set<string>;
  payments: Payment[];
  expenses: Expense[];
};

type MoneyFormatter = (amount: number) => string;

const INCOME_SIGN = "+";
const EXPENSE_SIGN = "−";

export function roundActivityAmount(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatActivityIncomeAmount(amount: number, formatMoney: MoneyFormatter): string {
  return `${INCOME_SIGN}${formatMoney(amount)}`;
}

export function formatActivityExpenseAmount(amount: number, formatMoney: MoneyFormatter): string {
  return `${EXPENSE_SIGN}${formatMoney(amount)}`;
}

export function buildPartnerActivityModel({
  selectedMonths,
  payments,
  expenses,
}: PartnerActivityInput): PartnerActivityModel {
  const sorted = [...selectedMonths].sort();
  let grandIncome = 0;
  let grandExpenses = 0;

  const months = sorted.map((monthKey) => {
    const monthPayments = payments
      .filter((payment) => isIncomePayment(payment.type) && monthKeyFromIso(payment.date) === monthKey)
      .sort((a, b) => b.date.localeCompare(a.date));
    const monthExpenses = expenses
      .filter((expense) => monthKeyFromIso(expense.date) === monthKey)
      .sort((a, b) => b.date.localeCompare(a.date));
    const incomeTotal = roundActivityAmount(monthPayments.reduce((sum, payment) => sum + payment.amount, 0));
    const expenseTotal = roundActivityAmount(monthExpenses.reduce((sum, expense) => sum + expense.amount, 0));

    grandIncome += incomeTotal;
    grandExpenses += expenseTotal;

    return { monthKey, incomeTotal, expenseTotal, payments: monthPayments, expenses: monthExpenses };
  });

  return {
    months,
    grandIncome: roundActivityAmount(grandIncome),
    grandExpenses: roundActivityAmount(grandExpenses),
  };
}
