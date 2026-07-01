import { PaymentType } from "@taxi/shared";
import type { Expense, Payment } from "../../types";

export function monthKeyFromIso(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function isIncomePayment(type: PaymentType): boolean {
  return type === PaymentType.RENT || type === PaymentType.FINE;
}

export function partnerPaymentDescription(
  payment: Pick<Payment, "driver" | "note">,
): string {
  const driver = payment.driver?.fullName?.trim();
  const note = payment.note?.trim();
  if (driver && note) return `${driver} — ${note}`;
  return driver || note || "—";
}

/** Plate + action note only — no category or custom tags. */
export function partnerExpenseDescription(
  expense: Pick<Expense, "car" | "note">,
): string {
  const plate = expense.car?.plate?.trim();
  const note = expense.note?.trim();
  if (plate && note) return `${plate} · ${note}`;
  return note || plate || "—";
}
