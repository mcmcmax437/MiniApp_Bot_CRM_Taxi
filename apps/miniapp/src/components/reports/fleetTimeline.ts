import { RentPeriod, agreementDriverDisplayName } from "@taxi/shared";
import type { Agreement } from "../../types";

export type TimelineScale = "week" | "month" | "year";

export type TimelineRange = { from: string; to: string };

export type TimelineBar = {
  agreementId: string;
  carId: string;
  plate: string;
  driverName: string;
  overlapFrom: string;
  overlapTo: string;
  days: number;
  expectedRent: number;
  leftPct: number;
  widthPct: number;
  /** 1-based grid column; span equals the number of days (or months in year view). */
  colStart: number;
  colSpan: number;
};

export type TimelineRow = {
  carId: string;
  plate: string;
  bars: TimelineBar[];
  days: number;
  expectedRent: number;
};

export type TimelineHeatCell = {
  key: string;
  label: string;
  cars: number;
};

export type TimelineModel = {
  range: TimelineRange;
  columns: { key: string; label: string; weekend: boolean }[];
  heat: TimelineHeatCell[];
  rows: TimelineRow[];
  activeCars: number;
  carDays: number;
  expectedRent: number;
  idleCars: number;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseLocalYmd(ymd: string): Date {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export function addDaysYmd(ymd: string, days: number): string {
  const d = parseLocalYmd(ymd);
  d.setDate(d.getDate() + days);
  return toYmd(d);
}

export function daysInclusive(from: string, to: string): number {
  const a = parseLocalYmd(from).getTime();
  const b = parseLocalYmd(to).getTime();
  if (b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

export function eachYmd(from: string, to: string): string[] {
  const out: string[] = [];
  if (from > to) return out;
  for (let cur = from; cur <= to; cur = addDaysYmd(cur, 1)) out.push(cur);
  return out;
}

function isoMondayOnOrBefore(ymd: string): Date {
  const d = parseLocalYmd(ymd);
  const dayNr = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dayNr);
  return d;
}

export function isoWeekRangeContaining(ymd: string): TimelineRange {
  const monday = isoMondayOnOrBefore(ymd);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: toYmd(monday), to: toYmd(sunday) };
}

export function monthRangeContaining(ymd: string): TimelineRange {
  const d = parseLocalYmd(ymd);
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from: toYmd(from), to: toYmd(to) };
}

export function yearRangeContaining(ymd: string): TimelineRange {
  const d = parseLocalYmd(ymd);
  return {
    from: `${d.getFullYear()}-01-01`,
    to: `${d.getFullYear()}-12-31`,
  };
}

export function rangeForScale(scale: TimelineScale, anchorYmd: string): TimelineRange {
  if (scale === "week") return isoWeekRangeContaining(anchorYmd);
  if (scale === "month") return monthRangeContaining(anchorYmd);
  return yearRangeContaining(anchorYmd);
}

export function shiftTimelineRange(
  scale: TimelineScale,
  range: TimelineRange,
  direction: -1 | 1,
): TimelineRange {
  if (scale === "week") {
    return {
      from: addDaysYmd(range.from, direction * 7),
      to: addDaysYmd(range.to, direction * 7),
    };
  }
  if (scale === "month") {
    const d = parseLocalYmd(range.from);
    d.setMonth(d.getMonth() + direction);
    return monthRangeContaining(toYmd(d));
  }
  const year = parseLocalYmd(range.from).getFullYear() + direction;
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export function defaultTimelineRange(scale: TimelineScale, asOfYmd: string): TimelineRange {
  if (scale === "week") {
    // Monday workflow: previous ISO week (Mon–Sun).
    const thisWeek = isoWeekRangeContaining(asOfYmd);
    return { from: addDaysYmd(thisWeek.from, -7), to: addDaysYmd(thisWeek.to, -7) };
  }
  return rangeForScale(scale, asOfYmd);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Pro-rate contractual rent over the overlapping calendar days. */
export function expectedRentForDays(amount: number, period: RentPeriod, days: number): number {
  if (!(amount > 0) || days <= 0) return 0;
  if (period === RentPeriod.DAILY) return round2(amount * days);
  if (period === RentPeriod.WEEKLY) return round2((amount * days) / 7);
  if (period === RentPeriod.MONTHLY) return round2((amount * days) / 30);
  return round2((amount * days) / 365);
}

export function clipAgreementToRange(
  startDate: string,
  endDate: string | null,
  range: TimelineRange,
): { from: string; to: string; days: number } | null {
  const start = startDate.slice(0, 10);
  const end = endDate?.slice(0, 10) ?? range.to;
  const from = start > range.from ? start : range.from;
  const to = end < range.to ? end : range.to;
  if (from > to) return null;
  return { from, to, days: daysInclusive(from, to) };
}

type RawClip = {
  agreementId: string;
  carId: string;
  plate: string;
  driverName: string;
  startDate: string;
  overlapFrom: string;
  overlapTo: string;
  rentAmount: number;
  period: RentPeriod;
};

/**
 * One car, one driver at a time. If the next rental starts on the day the
 * previous ends, that handover day belongs to the incoming driver so tags
 * sit end-to-end instead of stacking on the same day.
 */
export function separateSequentialBars(clips: RawClip[]): RawClip[] {
  const sorted = [...clips].sort((a, b) => {
    const byFrom = a.overlapFrom.localeCompare(b.overlapFrom);
    if (byFrom !== 0) return byFrom;
    return a.startDate.localeCompare(b.startDate) || a.agreementId.localeCompare(b.agreementId);
  });
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i]!;
    const next = sorted[i + 1]!;
    if (next.overlapFrom <= cur.overlapTo) {
      cur.overlapTo = addDaysYmd(next.overlapFrom, -1);
    }
  }
  return sorted.filter((c) => c.overlapFrom <= c.overlapTo);
}

function monthKey(ymd: string): string {
  return ymd.slice(0, 7);
}

function barPlacement(
  overlapFrom: string,
  overlapTo: string,
  range: TimelineRange,
  scale: TimelineScale,
): { leftPct: number; widthPct: number; colStart: number; colSpan: number } {
  if (scale === "year") {
    const startM = Number(overlapFrom.slice(5, 7));
    const endM = Number(overlapTo.slice(5, 7));
    const colStart = Math.min(12, Math.max(1, startM));
    const colSpan = Math.max(1, endM - startM + 1);
    return {
      colStart,
      colSpan,
      leftPct: round2(((colStart - 1) / 12) * 100),
      widthPct: round2((colSpan / 12) * 100),
    };
  }
  const total = daysInclusive(range.from, range.to);
  const span = daysInclusive(overlapFrom, overlapTo);
  const startOffset = daysInclusive(range.from, overlapFrom) - 1;
  const colStart = startOffset + 1;
  const colSpan = Math.max(1, span);
  if (total <= 0) return { leftPct: 0, widthPct: 0, colStart: 1, colSpan };
  return {
    colStart,
    colSpan,
    leftPct: round2((startOffset / total) * 100),
    widthPct: round2((span / total) * 100),
  };
}

function plateOf(agreement: Agreement): string {
  return agreement.car?.plate ?? agreement.carId;
}

export function buildFleetTimeline(
  agreements: Agreement[],
  cars: { id: string; plate: string }[],
  range: TimelineRange,
  scale: TimelineScale,
  columnLabel: (ymd: string) => string,
): TimelineModel {
  const days = eachYmd(range.from, range.to);
  const columns =
    scale === "year"
      ? Array.from({ length: 12 }, (_, i) => {
          const key = `${range.from.slice(0, 4)}-${pad2(i + 1)}`;
          return { key, label: columnLabel(`${key}-01`), weekend: false };
        })
      : days.map((ymd) => {
          const dow = parseLocalYmd(ymd).getDay();
          return { key: ymd, label: columnLabel(ymd), weekend: dow === 0 || dow === 6 };
        });

  const carLabel = new Map(cars.map((c) => [c.id, c.plate]));
  const rawClips: RawClip[] = [];
  for (const a of agreements) {
    const clip = clipAgreementToRange(a.startDate, a.endDate, range);
    if (!clip) continue;
    rawClips.push({
      agreementId: a.id,
      carId: a.carId,
      plate: plateOf(a),
      driverName: agreementDriverDisplayName(a),
      startDate: a.startDate.slice(0, 10),
      overlapFrom: clip.from,
      overlapTo: clip.to,
      rentAmount: a.rentAmount,
      period: a.period,
    });
  }

  const byCar = new Map<string, RawClip[]>();
  for (const clip of rawClips) {
    const list = byCar.get(clip.carId) ?? [];
    list.push(clip);
    byCar.set(clip.carId, list);
  }

  const rows: TimelineRow[] = [...byCar.entries()]
    .map(([carId, clips]) => {
      const separated = separateSequentialBars(clips);
      const bars: TimelineBar[] = separated.map((clip) => {
        const days = daysInclusive(clip.overlapFrom, clip.overlapTo);
        const place = barPlacement(clip.overlapFrom, clip.overlapTo, range, scale);
        return {
          agreementId: clip.agreementId,
          carId: clip.carId,
          plate: clip.plate,
          driverName: clip.driverName,
          overlapFrom: clip.overlapFrom,
          overlapTo: clip.overlapTo,
          days,
          expectedRent: expectedRentForDays(clip.rentAmount, clip.period, days),
          leftPct: place.leftPct,
          widthPct: place.widthPct,
          colStart: place.colStart,
          colSpan: place.colSpan,
        };
      });
      const daySet = new Set<string>();
      let expected = 0;
      for (const bar of bars) {
        expected += bar.expectedRent;
        for (let cur = bar.overlapFrom; cur <= bar.overlapTo; cur = addDaysYmd(cur, 1)) {
          daySet.add(cur);
        }
      }
      return {
        carId,
        plate: carLabel.get(carId) ?? bars[0]?.plate ?? carId,
        bars,
        days: daySet.size,
        expectedRent: round2(expected),
      };
    })
    .filter((row) => row.bars.length > 0)
    .sort((a, b) => a.plate.localeCompare(b.plate));

  const carsOnDay = new Map<string, Set<string>>();
  for (const row of rows) {
    for (const bar of row.bars) {
      for (let cur = bar.overlapFrom; cur <= bar.overlapTo; cur = addDaysYmd(cur, 1)) {
        const set = carsOnDay.get(cur) ?? new Set<string>();
        set.add(bar.carId);
        carsOnDay.set(cur, set);
      }
    }
  }

  const heat: TimelineHeatCell[] =
    scale === "year"
      ? columns.map((col) => {
          const seen = new Set<string>();
          for (const [ymd, set] of carsOnDay) {
            if (monthKey(ymd) === col.key) {
              for (const id of set) seen.add(id);
            }
          }
          return { key: col.key, label: col.label, cars: seen.size };
        })
      : days.map((ymd) => ({
          key: ymd,
          label: columnLabel(ymd),
          cars: carsOnDay.get(ymd)?.size ?? 0,
        }));

  const idleCars = cars.filter((c) => !byCar.has(c.id)).length;

  return {
    range,
    columns,
    heat,
    rows,
    activeCars: rows.length,
    carDays: rows.reduce((s, r) => s + r.days, 0),
    expectedRent: round2(rows.reduce((s, r) => s + r.expectedRent, 0)),
    idleCars,
  };
}

export function barColor(seed: string): string {
  const palette = ["#448aff", "#69f0ae", "#ffc107", "#b388ff", "#ff8a65", "#4dd0e1", "#f48fb1"];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length]!;
}
