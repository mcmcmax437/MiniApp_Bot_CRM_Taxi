/**
 * Helpers for "days worked last week" on the add-payment form.
 * "Last week" = previous ISO week (Mon–Sun) relative to the payment date.
 */

function parseLocalYmd(ymd: string): Date {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysYmd(ymd: string, days: number): string {
  const d = parseLocalYmd(ymd);
  d.setDate(d.getDate() + days);
  return toYmd(d);
}

/** Previous ISO week (Mon–Sun) before the week that contains `asOfYmd`. */
export function previousIsoWeekRange(asOfYmd: string): { from: string; to: string } {
  const d = parseLocalYmd(asOfYmd.slice(0, 10));
  const dayNr = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  const thisMonday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dayNr);
  const prevMonday = new Date(thisMonday);
  prevMonday.setDate(thisMonday.getDate() - 7);
  const prevSunday = new Date(prevMonday);
  prevSunday.setDate(prevMonday.getDate() + 6);
  return { from: toYmd(prevMonday), to: toYmd(prevSunday) };
}

type AgreementSpan = {
  startDate: string;
  endDate: string | null;
  status?: string;
};

/**
 * Count unique calendar days in [from, to] when any of the agreements
 * was active (start ≤ day ≤ end; open-ended ACTIVE runs through `to`).
 */
export function countActiveDaysInRange(
  agreements: AgreementSpan[],
  from: string,
  to: string,
): number {
  const rangeFrom = from.slice(0, 10);
  const rangeTo = to.slice(0, 10);
  if (rangeFrom > rangeTo) return 0;

  const days = new Set<string>();
  for (const a of agreements) {
    const start = a.startDate.slice(0, 10);
    const end = a.endDate?.slice(0, 10) ?? rangeTo;
    const overlapStart = start > rangeFrom ? start : rangeFrom;
    const overlapEnd = end < rangeTo ? end : rangeTo;
    if (overlapStart > overlapEnd) continue;
    for (let cur = overlapStart; cur <= overlapEnd; cur = addDaysYmd(cur, 1)) {
      days.add(cur);
    }
  }
  return days.size;
}

/** Days the driver had this car last ISO week (relative to payment date). */
export function daysWorkedLastWeek(
  agreements: AgreementSpan[],
  paymentDateYmd: string,
): { days: number; from: string; to: string } {
  const { from, to } = previousIsoWeekRange(paymentDateYmd);
  return {
    days: countActiveDaysInRange(agreements, from, to),
    from,
    to,
  };
}
