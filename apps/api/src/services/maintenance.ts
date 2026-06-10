import type { MaintenanceIntervalKind, MaintenanceRule } from "@prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDaysBeforeList(raw: string): number[] {
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0)
    .sort((a, b) => b - a);
}

/** Calendar-day difference in UTC (matches YYYY-MM-DD display in the mini app). */
function utcDayMs(d: Date): number {
  return Date.parse(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function startOfDay(d: Date): Date {
  return new Date(utcDayMs(d));
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

function addMonths(d: Date, months: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}

/** Next calendar date for yearly month (1–12), on or after `from`. */
function nextYearlyMonth(from: Date, month1to12: number): Date {
  const y = from.getFullYear();
  let candidate = new Date(y, month1to12 - 1, 1);
  if (candidate.getTime() < startOfDay(from).getTime()) {
    candidate = new Date(y + 1, month1to12 - 1, 1);
  }
  return candidate;
}

export function computeNextDue(
  rule: Pick<MaintenanceRule, "intervalKind" | "intervalValue" | "yearlyMonth">,
  lastCompletedAt: Date | null,
  lastCompletedMileage: number | null,
): { nextDueDate: Date | null; nextDueMileage: number | null } {
  const baseDate = lastCompletedAt ?? new Date();
  const baseMileage = lastCompletedMileage ?? 0;

  switch (rule.intervalKind as MaintenanceIntervalKind) {
    case "DAYS":
      return { nextDueDate: addDays(baseDate, rule.intervalValue), nextDueMileage: null };
    case "MONTHS":
      return { nextDueDate: addMonths(baseDate, rule.intervalValue), nextDueMileage: null };
    case "MILEAGE":
      return { nextDueDate: null, nextDueMileage: baseMileage + rule.intervalValue };
    case "YEARLY": {
      const m = rule.yearlyMonth ?? 1;
      return { nextDueDate: nextYearlyMonth(baseDate, m), nextDueMileage: null };
    }
    default:
      return { nextDueDate: null, nextDueMileage: null };
  }
}

export function isMaintenanceDue(
  rule: Pick<
    MaintenanceRule,
    "intervalKind" | "nextDueDate" | "nextDueMileage" | "isActive"
  >,
  currentMileage: number | null,
  asOf = new Date(),
): boolean {
  if (!rule.isActive) return false;
  if (rule.nextDueDate && startOfDay(rule.nextDueDate).getTime() <= startOfDay(asOf).getTime()) {
    return true;
  }
  if (
    rule.nextDueMileage != null &&
    currentMileage != null &&
    currentMileage >= rule.nextDueMileage
  ) {
    return true;
  }
  return false;
}

export function daysUntil(date: Date, from = new Date()): number {
  return Math.round((utcDayMs(date) - utcDayMs(from)) / DAY_MS);
}
