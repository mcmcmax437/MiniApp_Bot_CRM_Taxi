const DAY_MS = 24 * 60 * 60 * 1000;

export type ExpiryUrgency = "unknown" | "ok" | "soon" | "warning" | "overdue";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Days from today until the expiry date (negative = overdue). */
export function daysUntilExpiry(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const parsed = new Date(isoDate.length === 10 ? `${isoDate}T12:00:00.000Z` : isoDate);
  if (Number.isNaN(parsed.getTime())) return null;
  const today = startOfDay(new Date());
  const target = startOfDay(parsed);
  return Math.floor((target.getTime() - today.getTime()) / DAY_MS);
}

export function expiryUrgency(isoDate: string | null | undefined): ExpiryUrgency {
  const days = daysUntilExpiry(isoDate);
  if (days == null) return "unknown";
  if (days < 0) return "overdue";
  if (days <= 14) return "warning";
  if (days <= 45) return "soon";
  return "ok";
}
