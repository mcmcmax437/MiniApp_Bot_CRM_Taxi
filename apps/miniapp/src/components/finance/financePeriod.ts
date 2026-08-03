export type FinancePeriod = "all" | "month" | "year" | "custom";

/** Inclusive calendar-day range for `period === "custom"` (YYYY-MM-DD). */
export type FinanceDateRange = { from: string; to: string };

/** Normalize to YYYY-MM-DD for calendar comparisons (avoids UTC shift). */
export function financeDateKey(dateStr: string): string {
  return dateStr.slice(0, 10);
}

export function normalizeFinanceCustomRange(
  fromRaw: string,
  toRaw: string,
): FinanceDateRange | null {
  if (!fromRaw || !toRaw) return null;
  const from = fromRaw <= toRaw ? fromRaw : toRaw;
  const to = fromRaw <= toRaw ? toRaw : fromRaw;
  return { from, to };
}

export function commitFinanceCustomRange(
  fromRaw: string,
  toRaw: string,
  onDateRangeChange: ((range: FinanceDateRange | null) => void) | undefined,
  onPeriodChange: (v: FinancePeriod) => void,
): boolean {
  const range = normalizeFinanceCustomRange(fromRaw, toRaw);
  if (!range) return false;
  onDateRangeChange?.(range);
  onPeriodChange("custom");
  return true;
}

/**
 * Whether a transaction date falls in the selected finance period.
 * For `custom`, both `range.from` and `range.to` must be set; otherwise
 * nothing matches until the owner applies a range.
 */
export function financeInPeriod(
  dateStr: string,
  period: FinancePeriod,
  range?: FinanceDateRange | null,
): boolean {
  if (period === "all") return true;
  const key = financeDateKey(dateStr);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;

  if (period === "custom") {
    const normalized = normalizeFinanceCustomRange(range?.from ?? "", range?.to ?? "");
    return normalized ? key >= normalized.from && key <= normalized.to : false;
  }

  const [y, m] = key.split("-").map(Number);
  const now = new Date();
  if (period === "month") {
    return y === now.getFullYear() && m === now.getMonth() + 1;
  }
  return y === now.getFullYear();
}
