export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Cars attached to an expense. Falls back to the legacy single `carId`. */
export function linkedExpenseCarIds(expense: {
  carId?: string | null;
  cars?: { id: string }[] | null;
}): string[] {
  const fromLinks = [...new Set((expense.cars ?? []).map((c) => c.id).filter(Boolean))];
  if (fromLinks.length > 0) return fromLinks;
  return expense.carId ? [expense.carId] : [];
}

export function expensePlateLabel(
  expense: {
    carId?: string | null;
    car?: { plate: string } | null;
    cars?: { plate: string }[] | null;
  },
  noneLabel: string,
): string {
  const plates = (expense.cars ?? []).map((c) => c.plate?.trim()).filter(Boolean);
  if (plates.length > 0) return plates.join(", ");
  const fallback = expense.car?.plate?.trim();
  return fallback || noneLabel;
}

/** Even shares that add back up to the original amount. */
export function splitExpenseAmount(amount: number, parts: number): number[] {
  if (parts <= 0) return [];
  const total = roundMoney(amount);
  if (parts === 1) return [total];
  const base = Math.floor((total / parts) * 100) / 100;
  const shares = Array.from({ length: parts - 1 }, () => base);
  const used = roundMoney(base * (parts - 1));
  shares.push(roundMoney(total - used));
  return shares;
}

/**
 * How much of an expense belongs to the selected cars.
 * `selected === null` counts the full amount once (fleet total).
 */
export function expenseAmountForSelection(
  amount: number,
  carIds: string[],
  selected: ReadonlySet<string> | null,
): number {
  if (!selected) return roundMoney(amount);
  if (carIds.length === 0) return 0;
  const shares = splitExpenseAmount(amount, carIds.length);
  let sum = 0;
  carIds.forEach((id, i) => {
    if (selected.has(id)) sum += shares[i] ?? 0;
  });
  return roundMoney(sum);
}

/** Expense list filter: empty filters match everything; "" matches an expense with no car. */
export function expenseMatchesCarFilter(
  expense: { carId?: string | null; cars?: { id: string }[] | null },
  filters: readonly string[],
): boolean {
  if (filters.length === 0) return true;
  const ids = linkedExpenseCarIds(expense);
  if (ids.length === 0) return filters.includes("");
  return ids.some((id) => filters.includes(id));
}
