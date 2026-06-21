import type { ExpenseCategory, PaymentType } from "@taxi/shared";

// i18next's `t` can be called with a single key (e.g. `t("finance.RENT")`)
// or with a key plus an interpolation object (e.g. `t("finance.discountTag", {
// value: 300 })`). The narrow `(key) => string` signature is convenient
// inside these pure label helpers because they don't pull in i18next as a
// dependency, but it has to allow the second argument so the helpers
// remain type-safe when callers want to interpolate.
type Translate = (key: string, options?: Record<string, unknown>) => string;

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
    // Optional inline discount recorded on the same RENT payment. Shown
    // as a separate segment so the user can see at a glance that the
    // rent was reduced (e.g. "−300 zł discount" between the plate and
    // the payment type).
    discountAmount?: number;
  },
  dateLabel: string,
  t: Translate,
  noneLabel: string = "—",
): string {
  const hasNote = Boolean(payment.note?.trim());
  const plate = payment.car?.plate ?? noneLabel;
  const discountTag =
    payment.discountAmount && payment.discountAmount > 0
      ? t("finance.discountTag", {
          value: payment.discountAmount.toLocaleString(),
        })
      : null;
  return [
    dateLabel,
    plate,
    discountTag,
    hasNote && payment.driver?.fullName ? payment.driver.fullName : null,
    t(`finance.${payment.type}`),
    t(`finance.${payment.method}`),
  ]
    .filter(Boolean)
    .join(" · ");
}
