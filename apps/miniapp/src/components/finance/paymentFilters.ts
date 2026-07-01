import type { Payment } from "../../types";

export function paymentMatchesSearch(
  payment: Pick<Payment, "driver" | "car" | "note" | "amount">,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = `${payment.driver?.fullName ?? ""} ${payment.car?.plate ?? ""} ${payment.note ?? ""} ${payment.amount}`.toLowerCase();
  return hay.includes(q);
}
