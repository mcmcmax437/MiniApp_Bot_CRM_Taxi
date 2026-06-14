import type { ExpenseCategory, PaymentType } from "@taxi/shared";

type Translate = (key: string) => string;

export function expenseDisplayTitle(
  expense: {
    note?: string | null;
    tag?: string | null;
    category: ExpenseCategory;
  },
  t: Translate,
): string {
  const note = expense.note?.trim();
  if (note) return note;
  const tag = expense.tag?.trim();
  if (tag) return tag;
  return t(`finance.${expense.category}`);
}

export function expenseDisplaySubtitle(
  expense: {
    note?: string | null;
    tag?: string | null;
    category: ExpenseCategory;
    car?: { plate: string } | null;
  },
  dateLabel: string,
  t: Translate,
  noneLabel: string,
): string {
  const hasCustomTitle = Boolean(expense.note?.trim() || expense.tag?.trim());
  return [
    dateLabel,
    expense.car?.plate ?? noneLabel,
    hasCustomTitle ? t(`finance.${expense.category}`) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function paymentDisplayTitle(
  payment: {
    note?: string | null;
    type: PaymentType;
    driver?: { fullName: string } | null;
  },
  t: Translate,
  noneLabel: string,
): string {
  const note = payment.note?.trim();
  if (note) return note;
  return payment.driver?.fullName ?? noneLabel;
}

export function paymentDisplaySubtitle(
  payment: {
    note?: string | null;
    type: PaymentType;
    driver?: { fullName: string } | null;
    car?: { plate: string } | null;
    method: string;
  },
  dateLabel: string,
  t: Translate,
  noneLabel: string = "—",
): string {
  const hasNote = Boolean(payment.note?.trim());
  const plate = payment.car?.plate ?? noneLabel;
  return [
    dateLabel,
    plate,
    hasNote && payment.driver?.fullName ? payment.driver.fullName : null,
    t(`finance.${payment.type}`),
    t(`finance.${payment.method}`),
  ]
    .filter(Boolean)
    .join(" · ");
}
