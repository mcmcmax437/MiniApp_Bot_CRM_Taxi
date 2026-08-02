export type FinancePeriod = "all" | "month" | "year";

export type FinanceDateSort = "newest" | "oldest";

export function sortFinanceByDate<T>(
  items: T[],
  sort: FinanceDateSort,
  getDate: (item: T) => string,
): T[] {
  return [...items].sort((a, b) => {
    const diff = new Date(getDate(b)).getTime() - new Date(getDate(a)).getTime();
    return sort === "newest" ? diff : -diff;
  });
}

export function financeInPeriod(dateStr: string, period: FinancePeriod): boolean {
  if (period === "all") return true;
  const d = new Date(dateStr);
  const now = new Date();
  if (period === "month") {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  return d.getFullYear() === now.getFullYear();
}
