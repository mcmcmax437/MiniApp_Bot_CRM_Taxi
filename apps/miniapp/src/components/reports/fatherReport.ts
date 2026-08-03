import { ExpenseCategory, PaymentMethod, PaymentType } from "@taxi/shared";
import type { Expense, Payment } from "../../types";
import { isIncomePayment } from "./partnerSettlementFormat";

export type FatherPersonId = "max" | "oleh";

export type FatherPersonTotals = {
  incomeCash: number;
  incomeBank: number;
  incomeSum: number;
  expensePartner: number;
  expenseMine: number;
  expenseSum: number;
};

export function emptyFatherTotals(): FatherPersonTotals {
  return {
    incomeCash: 0,
    incomeBank: 0,
    incomeSum: 0,
    expensePartner: 0,
    expenseMine: 0,
    expenseSum: 0,
  };
}

function inInclusiveRange(dateStr: string, from: string, to: string): boolean {
  const d = dateStr.slice(0, 10);
  return d >= from.slice(0, 10) && d <= to.slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Sum income (rent+fines) and expenses for cars owned by one person. */
export function sumFatherPersonTotals(
  payments: Payment[],
  expenses: Expense[],
  carIds: ReadonlySet<string>,
  from: string,
  to: string,
): FatherPersonTotals {
  const out = emptyFatherTotals();
  if (carIds.size === 0) return out;

  for (const p of payments) {
    if (!p.carId || !carIds.has(p.carId)) continue;
    if (!inInclusiveRange(p.date, from, to)) continue;
    if (!isIncomePayment(p.type as PaymentType)) continue;
    if (p.method === PaymentMethod.CASH) out.incomeCash += p.amount;
    else out.incomeBank += p.amount;
  }

  for (const e of expenses) {
    if (!e.carId || !carIds.has(e.carId)) continue;
    if (!inInclusiveRange(e.date, from, to)) continue;
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

export function sumFatherTotals(
  a: FatherPersonTotals,
  b: FatherPersonTotals,
): FatherPersonTotals {
  return {
    incomeCash: round2(a.incomeCash + b.incomeCash),
    incomeBank: round2(a.incomeBank + b.incomeBank),
    incomeSum: round2(a.incomeSum + b.incomeSum),
    expensePartner: round2(a.expensePartner + b.expensePartner),
    expenseMine: round2(a.expenseMine + b.expenseMine),
    expenseSum: round2(a.expenseSum + b.expenseSum),
  };
}

/**
 * Assign a car to Max or Oleh. A car can belong to only one person;
 * selecting it for one removes it from the other.
 */
export function assignFatherCar(
  person: FatherPersonId,
  carId: string,
  maxCars: string[],
  olehCars: string[],
): { maxCars: string[]; olehCars: string[] } {
  const inMax = maxCars.includes(carId);
  const inOleh = olehCars.includes(carId);

  if (person === "max") {
    if (inMax) {
      return { maxCars: maxCars.filter((id) => id !== carId), olehCars };
    }
    return {
      maxCars: [...maxCars, carId],
      olehCars: olehCars.filter((id) => id !== carId),
    };
  }

  if (inOleh) {
    return { maxCars, olehCars: olehCars.filter((id) => id !== carId) };
  }
  return {
    maxCars: maxCars.filter((id) => id !== carId),
    olehCars: [...olehCars, carId],
  };
}
